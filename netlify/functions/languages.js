// Kept in sync with TRANSLATE_LANGUAGES in core-utils.js (the frontend list users actually
// pick from). Any code missing here gets hard-rejected by validator.js before it ever reaches
// Gemini, even though the user could select it in Settings — that mismatch previously blocked
// Portuguese (Brazil/Portugal), Spanish (Spain/Latin America), Irish, Maltese, Welsh, Twi,
// Chichewa, Shona, Sesotho, Kinyarwanda, Sinhala, Filipino, Khmer, and Burmese entirely.
const LANGUAGES = {
  "en": "English",
  // African & Nigerian
  "yo": "Yoruba", "ig": "Igbo", "ha": "Hausa", "sw": "Swahili", "zu": "Zulu",
  "xh": "Xhosa", "am": "Amharic", "so": "Somali", "ak": "Twi (Akan)", "wo": "Wolof",
  "af": "Afrikaans", "ny": "Chichewa", "sn": "Shona", "st": "Sesotho", "rw": "Kinyarwanda",
  // European
  "ar": "Arabic", "bg": "Bulgarian", "zh-CN": "Chinese (Simplified)", "zh-TW": "Chinese (Traditional)",
  "hr": "Croatian", "cs": "Czech", "da": "Danish", "nl": "Dutch", "et": "Estonian",
  "fi": "Finnish", "fr": "French", "de": "German", "el": "Greek", "hu": "Hungarian",
  "ga": "Irish", "it": "Italian", "lv": "Latvian", "lt": "Lithuanian", "mt": "Maltese",
  "no": "Norwegian", "pl": "Polish", "pt-BR": "Portuguese (Brazil)", "pt-PT": "Portuguese (Portugal)",
  "ro": "Romanian", "ru": "Russian", "sr": "Serbian", "sk": "Slovak", "sl": "Slovenian",
  "es-ES": "Spanish (Spain)", "es-US": "Spanish (Latin America)", "sv": "Swedish",
  "tr": "Turkish", "uk": "Ukrainian", "cy": "Welsh",
  // Middle East / South & Central Asia
  "he": "Hebrew", "fa": "Persian (Farsi)", "hi": "Hindi", "bn": "Bengali", "ur": "Urdu",
  "pa": "Punjabi", "ta": "Tamil", "te": "Telugu", "mr": "Marathi", "gu": "Gujarati",
  "ne": "Nepali", "si": "Sinhala",
  // East & Southeast Asia
  "id": "Indonesian", "ja": "Japanese", "ko": "Korean", "ms": "Malay", "th": "Thai",
  "tl": "Filipino (Tagalog)", "vi": "Vietnamese", "km": "Khmer", "my": "Burmese"
};

function getLanguageName(code) {
  return LANGUAGES[code] || code;
}

function isSupportedLanguage(code) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, code);
}

module.exports = {
  LANGUAGES,
  getLanguageName,
  isSupportedLanguage
};
