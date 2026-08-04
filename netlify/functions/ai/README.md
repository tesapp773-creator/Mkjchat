# MKJ AI Core

A brand-new, self-contained AI architecture for MKJ Chat. Deployed as a
single new Netlify Function (`netlify/functions/ai/`). It does **not**
modify, import, or depend on any existing backend file — translation,
messaging, Firebase, and auth all continue to work exactly as they do
today.

This is not a chatbot. It's the foundation every future AI feature
(chat, translation-assist, memory, vision, voice, file analysis, coding
assistant, writing assistant, agents, automation) plugs into.

---

## 1. Folder structure

```
netlify/functions/ai/
├── index.js                     # Netlify Function entrypoint (HTTP layer only)
├── router.js                    # action -> service dispatch table
├── config.js                    # ALL env var reads + validation live here
├── constants.js                 # enums: actions, providers, models, limits, http codes
├── README.md                    # this file
│
├── providers/                   # provider abstraction (no leakage into services)
│   ├── base.provider.js         # abstract interface every provider implements
│   ├── gemini.provider.js       # Gemini implementation
│   ├── openrouter.provider.js   # OpenRouter implementation
│   └── provider.manager.js      # registry + selection/fallback logic
│
├── services/                    # business logic, provider-agnostic
│   ├── chat.service.js          # chat orchestration
│   ├── search.service.js        # Tavily search (opt-in only, never auto-called)
│   ├── voice.service.js         # ElevenLabs TTS + LiveKit token minting
│   └── memory.service.js        # conversation memory INTERFACE (no persistence yet)
│
├── prompts/
│   ├── prompt.loader.js         # central prompt registry/renderer
│   └── system/
│       ├── default.prompt.js
│       ├── chat.prompt.js
│       └── search.prompt.js
│
├── middleware/
│   ├── auth.middleware.js       # reads existing Firebase bearer tokens (doesn't reimplement auth)
│   ├── validate.middleware.js   # top-level request envelope validation
│   └── rateLimit.middleware.js  # best-effort in-memory rate limiting
│
├── utils/
│   ├── logger.js                 # structured logging + future monitoring hooks
│   ├── response.js               # consistent success/CORS response builders
│   ├── http.js                   # event body parsing, bearer token extraction
│   ├── async.js                  # withTimeout, withRetry, sleep, safeJsonParse
│   └── validate.js               # input validation helpers
│
├── errors/
│   ├── AppError.js               # base + all custom error subclasses
│   └── errorHandler.js           # normalizes any thrown value into an HTTP response
│
└── types/
    └── index.js                  # JSDoc typedefs (editor intellisense only)
```

---

## 2. Request contract

**Endpoint:** `POST /.netlify/functions/ai`

```json
{
  "action": "chat",
  "payload": {
    "message": "Hello!",
    "history": []
  }
}
```

**Headers:** `Authorization: Bearer <firebase-id-token>` (required for
all actions except `health`, once a token verifier is wired in — see
§5).

**Success response:**

```json
{
  "success": true,
  "data": { "provider": "gemini", "model": "gemini-2.0-flash", "text": "..." },
  "meta": { "action": "chat", "provider": "gemini" }
}
```

**Error response:**

```json
{
  "error": {
    "message": "\"message\" is required and must be a non-empty string.",
    "code": "AI_VALIDATION_ERROR",
    "details": { "field": "message" },
    "timestamp": "2026-08-04T12:00:00.000Z"
  }
}
```

---

## 3. Supported actions today

| Action              | Service          | Notes                                          |
|----------------------|-------------------|-------------------------------------------------|
| `chat`               | chat.service      | Provider-agnostic chat completion              |
| `search`              | search.service    | Tavily web search — explicit opt-in only        |
| `voice.synthesize`    | voice.service     | ElevenLabs text-to-speech                       |
| `voice.token`         | voice.service     | Mint a LiveKit room access token                |
| `memory.get`          | memory.service    | Read conversation memory (in-memory today)      |
| `memory.append`       | memory.service    | Append to conversation memory (in-memory today) |
| `memory.clear`        | memory.service    | Clear conversation memory (in-memory today)     |
| `health`               | router            | Public. Reports provider/config availability    |

All actions are dispatched through `router.js`'s single handler table —
adding a new capability means adding one entry there plus a service
function. Nothing else changes.

---

## 4. Provider abstraction

Every provider implements `providers/base.provider.js`:

```js
isAvailable(): boolean
chatComplete({ messages, model, temperature, maxOutputTokens, systemPrompt }): Promise<NormalizedResult>
```

Services (`chat.service.js`) only ever call `resolveProvider()` from
`provider.manager.js` and then the interface above. They never branch on
provider name or touch a provider's raw response shape. Adding a new
provider (Claude via OpenRouter, a local model, etc.) means:

1. Create `providers/<name>.provider.js` extending `BaseProvider`.
2. Register it in `providers/provider.manager.js`'s registry map.
3. Nothing else changes.

---

## 5. Wiring auth (required before enabling protected actions)

`middleware/auth.middleware.js` deliberately does **not** import
`firebase-admin` itself, so it can't collide with or duplicate your
existing Firebase initialization. Wire it up from your existing
backend's bootstrap code (not from inside `ai/`):

```js
// somewhere in your EXISTING backend startup, e.g. a shared init file
const { setTokenVerifier } = require('./ai/middleware/auth.middleware');
const admin = require('./your-existing-firebase-admin-init'); // your existing instance

setTokenVerifier((idToken) => admin.auth().verifyIdToken(idToken));
```

Until `setTokenVerifier` is called, any action not in the public set
(`health`) will fail closed with `401 AI_AUTH_ERROR` rather than
silently trusting an unverified token.

---

## 6. Memory layer status

`services/memory.service.js` currently uses `InMemoryMemoryStore` — a
volatile, per-warm-instance store that exists so the architecture is
runnable and testable today. **It is not durable** and will lose data on
cold start. It defines the exact store interface
(`append`/`list`/`clear`) that a future Firestore-backed store must
implement, so swapping it in later is a one-line change in
`memory.service.js` with zero impact on the router or any other caller.
Implementing that Firestore store is intentionally left as a separate,
reviewable task, per the mission scope ("do not implement database
persistence yet").

---

## 7. Environment variables used

All read exclusively through `config.js`, never inline elsewhere:

- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY` (+ optional `OPENROUTER_APP_URL`, `OPENROUTER_APP_NAME`)
- `TAVILY_API_KEY`
- `ELEVENLABS_API_KEY` (+ optional `ELEVENLABS_DEFAULT_VOICE_ID`)
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (+ optional `LIVEKIT_WS_URL`)
- Optional: `AI_DEFAULT_CHAT_PROVIDER` (`gemini` | `openrouter`, default `gemini`)
- Optional: `AI_REQUEST_TIMEOUT_MS` (default `30000`)

Missing keys never crash the function at boot — `config.js` only throws
a descriptive `ConfigError` when a feature that actually needs that key
is invoked. Call `health` any time to see what's currently configured.

---

## 8. Explicitly out of scope / untouched

- No existing file was modified, renamed, or deleted.
- No existing Gemini/translation/chat code was touched.
- Firebase initialization and security rules are untouched.
- Firebase Authentication itself is untouched (this module only reads
  tokens it's handed, via an injected verifier).
- No frontend code was added or modified — voice/LiveKit/ElevenLabs are
  backend-only in this pass.
- Database persistence for memory is deliberately not implemented yet.

---

## 9. Adding a future feature (e.g. AI Vision)

1. Add any new constants to `constants.js` (`ACTIONS.VISION_ANALYZE`, etc).
2. Add a `services/vision.service.js` with the business logic, calling
   providers only through `provider.manager.js`.
3. Add a prompt file under `prompts/system/` if needed and register it
   in `prompt.loader.js`.
4. Add one entry to the `handlers` table in `router.js`.
5. Done — `index.js` needs no changes.
