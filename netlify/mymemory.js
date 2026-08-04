async function translateWithMyMemory(
  message,
  sourceLanguage,
  targetLanguage
) {
  // Same language on both sides: nothing to translate, and asking MyMemory to do it
  // triggers its own internal error text ("PLEASE SELECT TWO DISTINCT LANGUAGES!"),
  // which — before this fix — got returned to users as if it were a real translation.
  if (sourceLanguage === targetLanguage) {
    return {
      success: true,
      provider: "mymemory",
      detectedLanguage: sourceLanguage,
      targetLanguage,
      needsTranslation: false,
      translation: message
    };
  }

  const params = new URLSearchParams({
    q: message,
    langpair: `${sourceLanguage}|${targetLanguage}`
  });

  if (process.env.MYMEMORY_EMAIL) {
    params.set("de", process.env.MYMEMORY_EMAIL);
  }

  const response = await fetch(
    `https://api.mymemory.translated.net/get?${params.toString()}`
  );

  const data = await response.json();

  const translation =
    data?.responseData?.translatedText;

  if (!translation) {
    throw new Error("MyMemory returned no translation.");
  }

  // MyMemory returns HTTP 200 even on internal failures, stuffing an error string into
  // translatedText instead of a real translation (daily quota hit, bad langpair, etc).
  // Catch those here so they never reach a user looking like real translated text.
  if (/MYMEMORY WARNING|QUOTA|INVALID LANGPAIR|PLEASE SELECT|AMOUNT OF WORDS/i.test(translation)) {
    throw new Error(`MyMemory error: ${translation}`);
  }

  return {
    success: true,
    provider: "mymemory",
    detectedLanguage: sourceLanguage,
    targetLanguage,
    needsTranslation:
      sourceLanguage !== targetLanguage,
    translation
  };
}

module.exports = {
  translateWithMyMemory
};
