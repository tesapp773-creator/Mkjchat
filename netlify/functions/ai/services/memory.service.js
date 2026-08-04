'use strict';

const { NotFoundError } = require('../errors/AppError');
const { requireString } = require('../utils/validate');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Memory Service
 * -----------------------------------------------------------------------
 * DESIGN ONLY - per the mission spec, this service defines the interface
 * and in-process contract for conversation memory, but does NOT persist
 * to Firestore (or anything else) yet. That is intentional: adding
 * Firestore writes here is a separate, explicit future task so it can
 * be reviewed on its own without risking existing collections/rules.
 *
 * The shape below is designed so that a future Firestore-backed
 * implementation is a drop-in replacement of `_store` (see
 * `InMemoryMemoryStore` at the bottom) - services and the router never
 * need to change.
 *
 * Store interface a future persistence layer must implement:
 *   async append(conversationId, entry): Promise<MemoryEntry>
 *   async list(conversationId, limit): Promise<MemoryEntry[]>
 *   async clear(conversationId): Promise<void>
 */

/**
 * Volatile, per-invocation store. This exists ONLY so the architecture
 * is runnable/testable today. It is NOT durable across cold starts and
 * MUST be replaced before this feature is relied upon in production.
 */
class InMemoryMemoryStore {
  constructor() {
    /** @type {Map<string, import('../types').MemoryEntry[]>} */
    this._conversations = new Map();
    this._idCounter = 0;
  }

  async append(conversationId, entry) {
    const list = this._conversations.get(conversationId) || [];
    const record = {
      id: `mem_${Date.now()}_${this._idCounter++}`,
      conversationId,
      role: entry.role,
      content: entry.content,
      createdAt: Date.now(),
      metadata: entry.metadata || {},
    };
    list.push(record);
    this._conversations.set(conversationId, list);
    return record;
  }

  async list(conversationId, limit = 50) {
    const list = this._conversations.get(conversationId) || [];
    return list.slice(-limit);
  }

  async clear(conversationId) {
    this._conversations.delete(conversationId);
  }
}

/**
 * Active store implementation. Swap this line to point at a Firestore
 * (or other) implementation once that work is scoped, e.g.:
 *   const store = new FirestoreMemoryStore(db);
 */
const store = new InMemoryMemoryStore();

/**
 * Append a message to a conversation's memory.
 * @param {string} conversationId
 * @param {{role: string, content: string, metadata?: object}} entry
 * @returns {Promise<import('../types').MemoryEntry>}
 */
async function appendMemory(conversationId, entry) {
  requireString(conversationId, 'conversationId');
  requireString(entry?.role, 'role');
  requireString(entry?.content, 'content');

  logger.debug('Memory append', { conversationId, role: entry.role });
  return store.append(conversationId, entry);
}

/**
 * Retrieve recent memory entries for a conversation.
 * @param {string} conversationId
 * @param {number} [limit=50]
 * @returns {Promise<import('../types').MemoryEntry[]>}
 */
async function getMemory(conversationId, limit = 50) {
  requireString(conversationId, 'conversationId');
  const entries = await store.list(conversationId, limit);
  if (!entries) {
    throw new NotFoundError(`No memory found for conversation: ${conversationId}`);
  }
  return entries;
}

/**
 * Clear all memory for a conversation.
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
async function clearMemory(conversationId) {
  requireString(conversationId, 'conversationId');
  logger.debug('Memory clear', { conversationId });
  await store.clear(conversationId);
}

module.exports = {
  appendMemory,
  getMemory,
  clearMemory,
  // Exported for future swap-in / testing only:
  InMemoryMemoryStore,
};
