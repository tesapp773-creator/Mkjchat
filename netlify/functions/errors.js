const ERRORS = {
  MISSING_API_KEY: "Gemini API key is missing.",
  INVALID_REQUEST: "Invalid request.",
  INVALID_JSON: "Invalid JSON body.",
  MISSING_FIELDS: "Required fields are missing.",
  LANGUAGE_NOT_SUPPORTED: "Language is not supported.",
  MESSAGE_TOO_LONG: "Message exceeds the maximum allowed length.",
  GEMINI_FAILED: "Gemini translation failed.",
  MYMEMORY_FAILED: "MyMemory translation failed.",
  TRANSLATION_FAILED: "Translation failed.",
  INVALID_RESPONSE: "Invalid response from translation provider."
};

module.exports = ERRORS;
