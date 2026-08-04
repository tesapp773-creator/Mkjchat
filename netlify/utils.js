const CONFIG = require("./config");
const ERRORS = require("./errors");
const { isSupportedLanguage } = require("./languages");

function validateRequest(body) {
  if (!body) {
    throw new Error(ERRORS.INVALID_REQUEST);
  }

  const {
    text,
    targetLanguage
  } = body;

  if (!text || !targetLanguage) {
    throw new Error(ERRORS.MISSING_FIELDS);
  }

  if (text.length > CONFIG.MAX_MESSAGE_LENGTH) {
    throw new Error(ERRORS.MESSAGE_TOO_LONG);
  }

  if (!isSupportedLanguage(targetLanguage)) {
    throw new Error(ERRORS.LANGUAGE_NOT_SUPPORTED);
  }

  return true;
}

function cleanTranslation(text) {
  if (!text) return "";

  return text
    .trim()
    .replace(/^["']/, "")
    .replace(/["']$/, "");
}

function success(data) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  };
}

function failure(statusCode, message) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      success: false,
      error: message
    })
  };
}

module.exports = {
  validateRequest,
  cleanTranslation,
  success,
  failure
};
