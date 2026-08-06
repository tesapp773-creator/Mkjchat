'use strict';

const { ACTIONS } = require('./constants');
const { UnsupportedActionError, ValidationError } = require('./errors/AppError');
const { requireString } = require('./utils/validate');
const { getConfigStatus } = require('./config');

const chatService = require('./services/chat.service');
const searchService = require('./services/search.service');
const imageService = require('./services/image.service');
const voiceService = require('./services/voice.service');
const memoryService = require('./services/memory.service');
const { listProviders } = require('./providers/provider.manager');
const { listPrompts } = require('./prompts/prompt.loader');

/**
 * MKJ AI Core - Router
 * -----------------------------------------------------------------------
 * Maps a request's `action` string to a handler function. This is the
 * ONLY place that knows the full set of supported actions - index.js
 * (the Netlify entrypoint) just calls `dispatch(action, payload, ctx)`.
 *
 * Each handler receives:
 *   (payload: object, ctx: { uid: string|null, claims: object|null })
 * and must return a plain, JSON-serializable value.
 *
 * Adding a new capability = add one entry to `handlers` + implement the
 * corresponding service function. No other file needs to change.
 */

const handlers = {
  [ACTIONS.CHAT]: async (payload) => chatService.generateChatResponse(payload),

  [ACTIONS.SEARCH]: async (payload) => searchService.search(payload),

  [ACTIONS.IMAGE_GENERATE]: async (payload) => imageService.generateImage(payload),

  [ACTIONS.VOICE_SYNTHESIZE]: async (payload) => voiceService.synthesizeSpeech(payload),

  [ACTIONS.VOICE_TOKEN]: async (payload, ctx) =>
    voiceService.createLiveKitToken({
      ...payload,
      identity: payload.identity || ctx?.uid || undefined,
    }),

  [ACTIONS.MEMORY_GET]: async (payload) => {
    const conversationId = requireString(payload.conversationId, 'conversationId');
    return memoryService.getMemory(conversationId, payload.limit);
  },

  [ACTIONS.MEMORY_APPEND]: async (payload) => {
    const conversationId = requireString(payload.conversationId, 'conversationId');
    return memoryService.appendMemory(conversationId, {
      role: payload.role,
      content: payload.content,
      metadata: payload.metadata,
    });
  },

  [ACTIONS.MEMORY_CLEAR]: async (payload) => {
    const conversationId = requireString(payload.conversationId, 'conversationId');
    await memoryService.clearMemory(conversationId);
    return { cleared: true, conversationId };
  },

  [ACTIONS.HEALTH]: async () => ({
    status: 'ok',
    providers: listProviders(),
    prompts: listPrompts(),
    config: getConfigStatus(),
  }),
};

/**
 * Dispatch an action to its handler.
 * @param {string} action
 * @param {object} payload
 * @param {{uid: string|null, claims: object|null}} [ctx]
 * @returns {Promise<*>}
 */
async function dispatch(action, payload, ctx = {}) {
  const handler = handlers[action];
  if (!handler) {
    throw new UnsupportedActionError(action);
  }

  if (payload !== undefined && (typeof payload !== 'object' || payload === null)) {
    throw new ValidationError('"payload" must be an object.');
  }

  return handler(payload || {}, ctx);
}

module.exports = {
  dispatch,
  ACTIONS,
};
