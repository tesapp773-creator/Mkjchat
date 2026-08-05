const CONFIG = require("./config");
const ERRORS = require("./errors");
const { isSupportedLanguage } = require("./languages");

function validate(body) {
  if (!body) {
    throw new Error(ERRORS.INVALID_REQUEST);
  }

  const { text, targetLanguage } = body;

  if (!text || !targetLanguage) {
    throw new Error(ERRORS.MISSING_FIELDS);
  }

  if (typeof text !== "string") {
    throw new Error(ERRORS.INVALID_REQUEST);
  }

  if (text.trim().length === 0) {
    throw new Error(ERRORS.INVALID_REQUEST);
  }

  if (text.length > CONFIG.MAX_MESSAGE_LENGTH) {
    throw new Error(ERRORS.MESSAGE_TOO_LONG);
  }

  if (!isSupportedLanguage(targetLanguage)) {
    throw new Error(ERRORS.LANGUAGE_NOT_SUPPORTED);
  }

  return true;
}

module.exports = {
  validate
};
