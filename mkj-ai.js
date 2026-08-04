// ═════════════════════════════════════════════════════════════════════
// MKJ AI — Stage 1: Foundation + Home Screen
// ═════════════════════════════════════════════════════════════════════
// NEW, ADDITIVE FILE. Does not edit or override any function body in
// core-utils.js / chat-messaging.js / status-auth-misc.js.
//
// Design: the MKJ AI conversation is wired into the EXISTING 1-on-1 chat
// system (openPrivate / private_chats / conversations) using a reserved
// sentinel "uid". That means it automatically gets, for free, from code
// that already exists and is already tested:
//   - the same message bubble rendering (makeMsg/makeMsgCore)
//   - the same 🌐 Translate button + 3-layer translation cache
//   - reactions, replies, search-in-chat, swipe-to-reply, etc.
//   - the same "typing…" indicator (watchTyping, already wired in
//     openPrivate) — the AI just writes to the same typing/ path a real
//     user would
//   - the existing "pin a chat" mechanism (localStorage `pinned_chat_*`
//     flag that loadConvs() already reads) — used here to keep MKJ AI
//     pinned at the top, with ZERO changes to loadConvs()
//
// Loaded LAST (after core-utils.js, chat-messaging.js, status-auth-misc.js,
// feed.js, social-calls.js, extras.js) so every helper it depends on
// (db, me, auth, $, esc, ts, avUrl, openPrivate, chatId) already exists.
// ═════════════════════════════════════════════════════════════════════

const MKJ_AI_UID = 'mkj-ai';
const MKJ_AI_NAME = 'MKJ AI';
const MKJ_AI_BADGE = 'AI';
const MKJ_AI_PHOTO = (typeof avUrl === 'function') ? avUrl('MKJ AI', '7C3AED') : '';
const AI_CORE_ENDPOINT = '/.netlify/functions/ai';
const AI_HISTORY_LIMIT = 20;

function getMkjAiChatId() {
  if (!me) return null;
  return [me.uid, MKJ_AI_UID].sort().join('_');
}

// ── HOME SCREEN: permanent + pinned ─────────────────────────────────
// Idempotent. Safe to call on every login. Only WRITES to Firebase the
// very first time (guarded by a read-check), so it never stomps a real
// lastMessage/timestamp on repeat logins.
async function ensureMkjAiConversation() {
  if (!me) return;
  const aiChatId = getMkjAiChatId();

  // Reuses the app's own existing pin feature (see loadConvs() in
  // chat-messaging.js) — no new rendering code needed for "pin near the top".
  localStorage.setItem(`pinned_chat_${MKJ_AI_UID}`, 'true');

  try {
    const snap = await db.ref(`conversations/${me.uid}/${aiChatId}`).once('value');
    if (!snap.val()) {
      await db.ref(`conversations/${me.uid}/${aiChatId}`).set({
        targetUid: MKJ_AI_UID,
        targetUsername: MKJ_AI_NAME,
        targetMKJ: MKJ_AI_BADGE,
        targetPhoto: MKJ_AI_PHOTO,
        lastMessage: 'Ask me anything ✨',
        timestamp: Date.now(),
        unread: 0,
      });
    }
  } catch (e) {
    console.error('[mkj-ai] conversation bootstrap failed:', e);
  }
}

// Opens the AI conversation through the EXISTING private-chat screen —
// same view, same input bar, same everything a real chat gets.
function openMkjAi() {
  if (typeof openPrivate !== 'function') return;
  openPrivate(MKJ_AI_UID, MKJ_AI_NAME, MKJ_AI_BADGE, MKJ_AI_PHOTO);
}

// ── RESPONDER ────────────────────────────────────────────────────────
let _mkjAiListenerAttached = false;

function attachMkjAiResponder() {
  if (_mkjAiListenerAttached || !me) return;
  _mkjAiListenerAttached = true;

  const aiChatId = getMkjAiChatId();

  // orderByChild('timestamp').startAt(Date.now()) — only reacts to
  // messages sent from THIS moment forward. Firebase fires child_added
  // for every existing item on first .on() call; without startAt(), the
  // AI would "reply" to the entire chat history on every page load.
  db.ref(`private_chats/${aiChatId}`)
    .orderByChild('timestamp')
    .startAt(Date.now())
    .on('child_added', (snap) => {
      const msg = snap.val();
      if (!msg || msg.uid !== me.uid) return; // only react to the human's own messages
      if (msg.type && msg.type !== 'text') return; // Stage 1 is text-only; file/image AI comes in a later stage
      respondAsMkjAi(aiChatId, msg).catch((err) => console.error('[mkj-ai] respond failed:', err));
    });
}

async function buildMkjAiHistory(aiChatId, beforeTimestamp) {
  try {
    const snap = await db
      .ref(`private_chats/${aiChatId}`)
      .orderByChild('timestamp')
      .limitToLast(AI_HISTORY_LIMIT + 1)
      .once('value');
    const data = snap.val() || {};
    return Object.values(data)
      .filter((m) => (!m.type || m.type === 'text') && m.timestamp < beforeTimestamp)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-AI_HISTORY_LIMIT)
      .map((m) => ({ role: m.uid === MKJ_AI_UID ? 'assistant' : 'user', content: m.text || '' }))
      .filter((m) => m.content);
  } catch (e) {
    console.error('[mkj-ai] history fetch failed:', e);
    return [];
  }
}

async function respondAsMkjAi(aiChatId, triggerMsg) {
  const typingRef = db.ref(`typing/private/${aiChatId}/${MKJ_AI_UID}`);
  typingRef.set(Date.now());

  try {
    const history = await buildMkjAiHistory(aiChatId, triggerMsg.timestamp);

    let idToken = null;
    try {
      idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    } catch (e) {
      /* non-fatal — AI Core currently accepts unauthenticated chat calls, see ai/index.js */
    }

    const res = await fetch(AI_CORE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        action: 'chat',
        payload: {
          message: triggerMsg.text || '',
          history,
          promptId: 'chat',
          promptContext: { userName: me.username },
        },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && data.error && data.error.message) || `AI Core HTTP ${res.status}`);
    }

    const replyText = (data.data && data.data.text && data.data.text.trim()) || "Sorry, I don't have a response for that.";
    await pushMkjAiMessage(aiChatId, replyText);
  } catch (err) {
    console.error('[mkj-ai] chat request failed:', err);
    await pushMkjAiMessage(aiChatId, "Sorry — I couldn't process that just now. Please try again in a moment.");
  } finally {
    typingRef.remove();
  }
}

async function pushMkjAiMessage(aiChatId, text) {
  const msg = {
    uid: MKJ_AI_UID,
    username: MKJ_AI_NAME,
    mkjNumber: MKJ_AI_BADGE,
    photoURL: MKJ_AI_PHOTO,
    text,
    time: ts(),
    timestamp: Date.now(),
    type: 'text',
  };
  await db.ref(`private_chats/${aiChatId}`).push(msg);

  // Mirrors what sendToRef() already does for a normal incoming message,
  // scoped to just the human's own conversation index entry (the AI has
  // no conversations/ node of its own for anyone to read).
  const isChatCurrentlyOpen = chatId === aiChatId;
  await db.ref(`conversations/${me.uid}/${aiChatId}`).transaction((prev) => ({
    targetUid: MKJ_AI_UID,
    targetUsername: MKJ_AI_NAME,
    targetMKJ: MKJ_AI_BADGE,
    targetPhoto: MKJ_AI_PHOTO,
    lastMessage: text,
    timestamp: Date.now(),
    unread: isChatCurrentlyOpen ? 0 : ((prev && prev.unread) || 0) + 1,
  }));
}

// ── INIT ─────────────────────────────────────────────────────────────
// Independent auth listener. Firebase Auth supports multiple
// onAuthStateChanged listeners with no conflict, so this does not touch
// (or need to touch) the existing one in status-auth-misc.js.
auth.onAuthStateChanged((user) => {
  if (!user) {
    _mkjAiListenerAttached = false;
    return;
  }
  // The app's own post-login flow (status-auth-misc.js) populates the
  // global `me` object asynchronously after this fires. Wait for it
  // rather than duplicating that logic here.
  const waitForMe = (triesLeft) => {
    if (me) {
      ensureMkjAiConversation();
      attachMkjAiResponder();
      return;
    }
    if (triesLeft <= 0) return;
    setTimeout(() => waitForMe(triesLeft - 1), 250);
  };
  waitForMe(40); // ~10s max wait
});
