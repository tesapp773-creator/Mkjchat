'use strict';

/**
 * MKJ AI Core - Type Definitions
 * -----------------------------------------------------------------------
 * Plain CommonJS project (no TypeScript compiler in this codebase), so
 * these are JSDoc typedefs only. They export nothing at runtime - this
 * file exists purely so editors (VSCode/WebStorm) can provide
 * autocomplete and so the shapes are documented in one place.
 *
 * @typedef {Object} ChatMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 *
 * @typedef {Object} ChatCompletionResult
 * @property {string} provider
 * @property {string} model
 * @property {string} text
 * @property {Object} raw
 * @property {{promptTokens: number|null, completionTokens: number|null, totalTokens: number|null}} usage
 *
 * @typedef {Object} SearchResultItem
 * @property {string} title
 * @property {string} url
 * @property {string} content
 * @property {number} [score]
 *
 * @typedef {Object} SearchResult
 * @property {string} query
 * @property {SearchResultItem[]} results
 * @property {string} [answer]
 *
 * @typedef {Object} VoiceSynthesisResult
 * @property {string} contentType
 * @property {string} audioBase64
 * @property {string} voiceId
 * @property {string} model
 *
 * @typedef {Object} LiveKitTokenResult
 * @property {string} token
 * @property {string} url
 * @property {string} roomName
 * @property {string} identity
 * @property {number} expiresAt - Unix epoch seconds.
 *
 * @typedef {Object} MemoryEntry
 * @property {string} id
 * @property {string} conversationId
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 * @property {number} createdAt - Unix epoch millis.
 * @property {Object} [metadata]
 *
 * @typedef {Object} AiRequestEnvelope
 * @property {string} action - See constants.ACTIONS.
 * @property {Object} payload - Action-specific payload.
 *
 * @typedef {Object} AiUserContext
 * @property {string|null} uid
 * @property {string|null} token
 * @property {Object|null} claims
 */

module.exports = {};
