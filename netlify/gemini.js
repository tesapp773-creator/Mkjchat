const CONFIG = require("./config");
const ERRORS = require("./errors");
const logger = require("./logger");
const PROMPTS = require("./prompts");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimeout(name, fallback) {
  return CONFIG?.TIMEOUTS?.[name] ?? fallback;
}

function getMaxRetries() {
  return Number.isInteger(CONFIG?.MAX_RETRIES) ? CONFIG.MAX_RETRIES : 2;
}

function getRetryDelay() {
  return Number.isInteger(CONFIG?.RETRY_DELAY) ? CONFIG.RETRY_DELAY : 1000;
}

function getContentType() {
  return CONFIG?.DEFAULT_CONTENT_TYPE || "application/json";
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function extractGeminiText(data, requestId) {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text) {
    // Helps tell apart the different reasons Gemini can come back empty
    // (safety block, hit max tokens, etc.) next time this happens.
    const finishReason = data?.candidates?.[0]?.finishReason;
    const blockReason = data?.promptFeedback?.blockReason;
    logger.warn(requestId, `Gemini returned no text (finishReason=${finishReason || "n/a"}, blockReason=${blockReason || "n/a"})`);
  }

  return text;
}

function safeJsonParse(text) {
  // Defensive backstop: strip a ```json ... ``` or ``` ... ``` wrapper if the
  // model adds one despite responseMimeType being set to application/json.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function callGemini(requestId, prompt, timeoutMs, generationConfig = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(ERRORS.MISSING_API_KEY);
  }

  const maxRetries = getMaxRetries();
  const retryDelay = getRetryDelay();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.info(requestId, `Gemini attempt ${attempt + 1}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": getContentType(),
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            // Gemini 2.5 models "think" before answering by default, and
            // those invisible thinking tokens can eat the whole output
            // budget, leaving an empty final answer. Translation/detection
            // don't need reasoning, so thinking is switched off for
            // consistent, fast responses.
            generationConfig: {
              thinkingConfig: { thinkingBudget: 0 },
              ...generationConfig,
            },
          }),
        }
      );

      clearTimeout(timer);

      if (!response.ok) {
        const status = response.status;
        const retryable = isRetryableStatus(status);

        if (retryable && attempt < maxRetries) {
          logger.warn(requestId, `Gemini HTTP ${status}, retrying...`);
          await sleep(retryDelay * (attempt + 1));
          continue;
        }

        throw new Error(`Gemini HTTP ${status}`);
      }

      const data = await response.json();
      const text = extractGeminiText(data, requestId);

      if (!text) {
        throw new Error(ERRORS.INVALID_RESPONSE);
      }

      logger.info(requestId, "Gemini success");
      return text;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      const isAbort = error?.name === "AbortError";
      const shouldRetry = (isAbort || isRetryableStatus(error?.status)) && attempt < maxRetries;

      logger.warn(requestId, error?.message || "Gemini request failed");

      if (shouldRetry) {
        await sleep(retryDelay * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  logger.error(requestId, lastError?.message || "Gemini failed");
  throw lastError || new Error(ERRORS.GEMINI_FAILED);
}

async function translateWithGemini(requestId, text, targetLanguage) {
  const prompt = PROMPTS.buildTranslatePrompt(text, targetLanguage);
  const raw = await callGemini(
    requestId,
    prompt,
    getTimeout("TRANSLATION", 15000),
    { responseMimeType: "application/json" }
  );

  const parsed = safeJsonParse(raw);

  if (!parsed) {
    throw new Error(ERRORS.INVALID_RESPONSE);
  }

  return parsed;
}

async function detectLanguage(requestId, text) {
  const prompt = PROMPTS.buildDetectLanguagePrompt(text);
  const raw = await callGemini(
    requestId,
    prompt,
    getTimeout("DETECTION", 10000)
  );

  return raw.trim();
}

module.exports = {
  translateWithGemini,
  detectLanguage,
};
