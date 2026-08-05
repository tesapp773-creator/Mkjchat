const CONSTANTS = {
  PROVIDERS: {
    GEMINI: "gemini",
    MYMEMORY: "mymemory"
  },

  STATUS: {
    SUCCESS: "success",
    FAILED: "failed"
  },

  CONTENT_TYPE: "application/json",

  HTTP: {
    OK: 200,
    BAD_REQUEST: 400,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502
  }
};

module.exports = CONSTANTS;
