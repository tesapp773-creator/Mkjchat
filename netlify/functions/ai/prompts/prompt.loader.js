'use strict';

const defaultPrompt = require('./system/default.prompt');
const chatPrompt = require('./system/chat.prompt');
const searchPrompt = require('./system/search.prompt');
const { NotFoundError } = require('../errors/AppError');

/**
 * MKJ AI Core - Prompt Loader
 * -----------------------------------------------------------------------
 * Prompts live as small, independent modules under prompts/system/ (or
 * future prompts/<category>/ folders). Each module exports:
 *   { id: string, version: number, render: (ctx?) => string }
 *
 * This loader is the ONLY place that knows about all prompt files, so
 * services just ask for a prompt by id and pass context - they never
 * import a prompt file directly. Adding a new prompt = add a file here
 * + one line in the registry below.
 */

const registry = new Map([
  [defaultPrompt.id, defaultPrompt],
  [chatPrompt.id, chatPrompt],
  [searchPrompt.id, searchPrompt],
]);

/**
 * Render a prompt by id with optional context.
 * @param {string} promptId
 * @param {object} [context]
 * @returns {string}
 */
function renderPrompt(promptId, context = {}) {
  const prompt = registry.get(promptId);
  if (!prompt) {
    throw new NotFoundError(`Prompt not found: ${promptId}`);
  }
  return prompt.render(context);
}

/**
 * Register a new prompt at runtime (useful for tests or dynamically
 * generated prompts). Not required for normal operation.
 * @param {{id: string, version: number, render: Function}} promptModule
 */
function registerPrompt(promptModule) {
  registry.set(promptModule.id, promptModule);
}

/**
 * List all known prompt ids - useful for diagnostics.
 * @returns {string[]}
 */
function listPrompts() {
  return Array.from(registry.keys());
}

module.exports = {
  renderPrompt,
  registerPrompt,
  listPrompts,
};
