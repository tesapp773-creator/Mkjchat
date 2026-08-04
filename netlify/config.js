/**
 * MKJ Chat AI Configuration
 * Version: 2.0
 */

const CONFIG = {
  /**
   * Gemini AI
   */
  GEMINI_MODEL: "gemini-2.5-flash",

  /**
   * Timeouts (milliseconds)
   */
  TIMEOUTS: {
    DETECTION: 10000,
    TRANSLATION: 15000
  },

  /**
   * Retry configuration
   */
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,

  /**
   * Translation settings
   */
  MAX_MESSAGE_LENGTH: 5000,

  ENABLE_LANGUAGE_DETECTION: true,

  ENABLE_MYMEMORY_FALLBACK: true,

  /**
   * Logging
   */
  ENABLE_LOGGING: true,

  /**
   * Future Features
   */
  ENABLE_CACHE: false,

  ENABLE_AUTO_TRANSLATE: false,

  ENABLE_REQUEST_ID: true,

  ENABLE_METRICS: false,

  /**
   * API Response
   */
  DEFAULT_CONTENT_TYPE: "application/json"
};

module.exports = CONFIG;
