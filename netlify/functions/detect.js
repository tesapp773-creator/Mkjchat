const CONFIG = require("./config");
const logger = require("./logger");
const ERRORS = require("./errors");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function detectLanguage(text) {
  if (!text || !text.trim()) {
    throw new Error(ERRORS.INVALID_REQUEST);
  }

  if (!GEMINI_API_KEY) {
    throw new Error(ERRORS.MISSING_API_KEY);
  }

  const prompt = `
Detect the language of the following text.

Rules:
- Return ONLY the ISO 639-1 language code.
- Examples:
English -> en
French -> fr
Spanish -> es
Portuguese -> pt
German -> de
Italian -> it
Dutch -> nl
Russian -> ru
Arabic -> ar
Japanese -> ja
Chinese Simplified -> zh-CN
Chinese Traditional -> zh-TW
Hindi -> hi
Yoruba -> yo
Igbo -> ig
Hausa -> ha
Swahili -> sw
Zulu -> zu
Xhosa -> xh
Amharic -> am
Somali -> so
Twi -> ak
Wolof -> wo
Afrikaans -> af

Text:
${text}
`;

  try {
    logger.info("Detecting language...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    const code =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!code) {
      throw new Error(ERRORS.INVALID_RESPONSE);
    }

    logger.info(`Detected language: ${code}`);

    return code;

  } catch (err) {
    logger.error(err);

    return null;
  }
}

module.exports = {
  detectLanguage
};
