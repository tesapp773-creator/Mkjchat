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
// A brief window to let a caption arrive after a bare photo before
// auto-describing it - see the listener below for why.
let _pendingImageTimer = null;
const IMAGE_CAPTION_WAIT_MS = 2500;

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
      // Text messages and images are both handled (see respondAsMkjAi,
      // which figures out whether an image is attached to this turn).
      // Anything else (voice notes, files, gifs) is still out of scope.
      if (msg.type && msg.type !== 'text' && msg.type !== 'image') return;

      if (msg.type === 'image') {
        // This app sends a photo immediately on selection - there's no
        // "attach, then type a caption, then send" compose step. So a
        // caption is really just "the next message right after the
        // photo". Wait briefly before auto-describing, in case that
        // next message is about to arrive - avoids replying twice (once
        // to the bare photo, once to the caption) when the user is
        // clearly mid-thought, typing a question about what they just sent.
        if (_pendingImageTimer) clearTimeout(_pendingImageTimer);
        _pendingImageTimer = setTimeout(() => {
          _pendingImageTimer = null;
          respondAsMkjAi(aiChatId, msg).catch((err) => console.error('[mkj-ai] respond failed:', err));
        }, IMAGE_CAPTION_WAIT_MS);
        return;
      }

      // A text message arriving while a photo is still waiting for its
      // caption window IS that caption - cancel the pending auto-describe.
      // respondAsMkjAi's own preceding-message check (below) then attaches
      // the photo to this text automatically, producing one combined reply.
      if (_pendingImageTimer) {
        clearTimeout(_pendingImageTimer);
        _pendingImageTimer = null;
      }

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

/**
 * Fetch the single most recent message in the AI chat strictly before
 * a given timestamp. Used to detect "the user just sent a photo, and
 * this text message right after it is a caption/question about it" -
 * this app doesn't have a compose-with-caption UI step, photos send
 * immediately, so a caption is really just "the next message after the
 * photo". If the AI already replied to that photo, ITS reply becomes
 * the most recent message instead, so this naturally stops re-attaching
 * an old photo to unrelated later messages.
 * @param {string} aiChatId
 * @param {number} beforeTimestamp
 * @returns {Promise<object|null>}
 */
async function getPrecedingMessage(aiChatId, beforeTimestamp) {
  try {
    const snap = await db
      .ref(`private_chats/${aiChatId}`)
      .orderByChild('timestamp')
      .endAt(beforeTimestamp - 1)
      .limitToLast(1)
      .once('value');
    const data = snap.val() || {};
    const values = Object.values(data);
    return values.length ? values[0] : null;
  } catch (e) {
    console.error('[mkj-ai] preceding-message fetch failed:', e);
    return null;
  }
}

async function respondAsMkjAi(aiChatId, triggerMsg) {
  const typingRef = db.ref(`typing/private/${aiChatId}/${MKJ_AI_UID}`);
  typingRef.set(Date.now());

  try {
    const history = await buildMkjAiHistory(aiChatId, triggerMsg.timestamp);

    // Figure out if an image is attached to this turn, and what the
    // question/caption is - see getPrecedingMessage's doc comment above
    // for why "the previous message" is how a caption is detected here.
    // NOTE: the backend requires a non-empty message on every request
    // (even ones with an image attached), so a bare photo with no
    // caption always gets a sensible default question here - it can't
    // be sent as an empty string.
    const DEFAULT_IMAGE_QUESTION = 'Describe what is in this image in a friendly, conversational way.';
    let imageUrl = null;
    let question = triggerMsg.text || '';

    if (triggerMsg.type === 'image') {
      imageUrl = triggerMsg.url;
      question = (triggerMsg.text && triggerMsg.text.trim()) || DEFAULT_IMAGE_QUESTION;
    } else {
      const prev = await getPrecedingMessage(aiChatId, triggerMsg.timestamp);
      if (prev && prev.type === 'image' && prev.uid === me.uid) {
        imageUrl = prev.url;
        question = (triggerMsg.text && triggerMsg.text.trim()) || DEFAULT_IMAGE_QUESTION;
      }
    }

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
          message: question,
          history,
          promptId: 'chat',
          promptContext: { userName: me.username },
          ...(imageUrl ? { imageUrl } : {}),
        },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error((data && data.error && data.error.message) || `AI Core HTTP ${res.status}`);
    }

    if (data.data && data.data.type === 'image') {
      await pushMkjAiImage(aiChatId, data.data);
    } else {
      const replyText = (data.data && data.data.text && data.data.text.trim()) || "Sorry, I don't have a response for that.";
      await pushMkjAiMessage(aiChatId, replyText);
    }
  } catch (err) {
    console.error('[mkj-ai] chat request failed:', err);
    await pushMkjAiMessage(aiChatId, "Sorry — I couldn't process that just now. Please try again in a moment.");
  } finally {
    typingRef.remove();
  }
}

/**
 * Convert a base64 image (returned by the AI Core's image.generate
 * action) into a File, upload it through the SAME Cloudinary pipeline
 * every other photo message already uses (uploadCld, in core-utils.js),
 * then push it as a normal image-type chat message.
 */
async function pushMkjAiImage(aiChatId, imageData) {
  try {
    const byteChars = atob(imageData.image.base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const ext = imageData.image.mimeType === 'image/png' ? 'png' : 'jpg';
    const file = new File([byteArray], `mkj-ai-${Date.now()}.${ext}`, { type: imageData.image.mimeType });

    const url = await uploadCld(file);

    const msg = {
      uid: MKJ_AI_UID,
      username: MKJ_AI_NAME,
      mkjNumber: MKJ_AI_BADGE,
      photoURL: MKJ_AI_PHOTO,
      url,
      time: ts(),
      timestamp: Date.now(),
      type: 'image',
    };
    await db.ref(`private_chats/${aiChatId}`).push(msg);

    const isChatCurrentlyOpen = chatId === aiChatId;
    await db.ref(`conversations/${me.uid}/${aiChatId}`).transaction((prev) => ({
      targetUid: MKJ_AI_UID,
      targetUsername: MKJ_AI_NAME,
      targetMKJ: MKJ_AI_BADGE,
      targetPhoto: MKJ_AI_PHOTO,
      lastMessage: '[image]',
      timestamp: Date.now(),
      unread: isChatCurrentlyOpen ? 0 : ((prev && prev.unread) || 0) + 1,
    }));
  } catch (err) {
    console.error('[mkj-ai] image delivery failed:', err);
    await pushMkjAiMessage(aiChatId, "I generated an image but couldn't deliver it — please try again.");
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
