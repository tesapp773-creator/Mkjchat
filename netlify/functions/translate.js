// netlify/functions/translate.js
//
// Single translation endpoint: POST /.netlify/functions/translate
// { text, sourceLanguage, targetLanguage } -> { translation }
//
// Primary path: Gemini (gemini.js + prompts.js) detects the source language
// AND translates in one call. That's the cheapest and most accurate path,
// so it's used for every request that isn't a same-language shortcut.
//
// If that call fails (network error, timeout, bad JSON back, Gemini down),
// we do NOT blindly trust the frontend's sourceLanguage for the MyMemory
// fallback — it's really just the sender's saved preferred-language setting
// (see core-utils.js), not a check of this specific message. Instead we run
// a dedicated, lightweight detectLanguage() call to get a real answer, and
// only fall back to the frontend-supplied sourceLanguage if that detection
// call ALSO fails. This only costs an extra call on the failure path —
// normal, successful translations still cost exactly one Gemini call.

const CONFIG = require("./config");
const ERRORS = require("./errors");
const CONSTANTS = require("./constants");
const logger = require("./logger");
const response = require("./response");
const { validate } = require("./validator");
const { cleanTranslation } = require("./utils");
const { generateRequestId } = require("./requestId");
const { translateWithGemini, detectLanguage } = require("./gemini");
const { translateWithMyMemory } = require("./mymemory");

exports.handler = async (event) => {
  const requestId = generateRequestId();

  if (event.httpMethod !== "POST") {
    return response.error(requestId, CONSTANTS.HTTP.METHOD_NOT_ALLOWED, "Method not allowed");
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response.error(requestId, CONSTANTS.HTTP.BAD_REQUEST, ERRORS.INVALID_JSON);
  }

  try {
    validate(body);
  } catch (err) {
    return response.error(requestId, CONSTANTS.HTTP.BAD_REQUEST, err.message);
  }

  const { text, sourceLanguage, targetLanguage } = body;

  // NOTE: deliberately NOT short-circuiting here even if sourceLanguage === targetLanguage.
  // sourceLanguage is only ever a client-side GUESS (the sender's saved preference, or a
  // fallback lookup) — never a real check of what language this specific message is actually
  // written in. Forwarded messages in particular can carry a stale or wrong guess. Trusting
  // it to skip translation caused real translations to be silently skipped whenever the wrong
  // guess happened to coincidentally match the target language. Gemini's own prompt already
  // does a real "is this already in the target language?" check against the actual text
  // (see prompts.js), which is the only version of this check that's safe to rely on.

  try {
    const result = await translateWithGemini(requestId, text, targetLanguage);
    const translation = cleanTranslation(result?.translation) || text;

    logger.info(requestId, "Gemini translation ok");

    return response.success(requestId, {
      translation,
      provider: CONSTANTS.PROVIDERS.GEMINI,
      detectedLanguage: result?.detectedLanguage || sourceLanguage || null
    });
  } catch (geminiErr) {
    logger.warn(requestId, `Gemini failed: ${geminiErr.message}`);

    if (!CONFIG.ENABLE_MYMEMORY_FALLBACK) {
      return response.error(
        requestId,
        CONSTANTS.HTTP.BAD_GATEWAY,
        geminiErr.message || ERRORS.GEMINI_FAILED
      );
    }

    // Get a real detected language for the fallback instead of trusting
    // whatever the frontend guessed. Only runs because Gemini's translation
    // call already failed, so this doesn't add cost to the normal path.
    let fallbackSourceLanguage = sourceLanguage || null;
    try {
      const detected = await detectLanguage(requestId, text);
      if (detected) fallbackSourceLanguage = detected;
    } catch (detectErr) {
      logger.warn(requestId, `Language detection also failed: ${detectErr.message}`);
    }

    if (!fallbackSourceLanguage) {
      return response.error(requestId, CONSTANTS.HTTP.BAD_GATEWAY, ERRORS.TRANSLATION_FAILED);
    }

    try {
      const fallback = await translateWithMyMemory(text, fallbackSourceLanguage, targetLanguage);

      logger.info(requestId, "MyMemory fallback ok");

      return response.success(requestId, {
        translation: cleanTranslation(fallback.translation) || text,
        provider: CONSTANTS.PROVIDERS.MYMEMORY,
        detectedLanguage: fallbackSourceLanguage
      });
    } catch (fallbackErr) {
      logger.error(requestId, `MyMemory fallback also failed: ${fallbackErr.message}`);
      return response.error(requestId, CONSTANTS.HTTP.BAD_GATEWAY, ERRORS.TRANSLATION_FAILED);
    }
  }
};
