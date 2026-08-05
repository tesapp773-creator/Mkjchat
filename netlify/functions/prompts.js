const { getLanguageName } = require("./languages");

function buildDetectLanguagePrompt(text) {
  return `
You are an expert language detector.

Your task:
- Detect the primary language of the message.
- Return ONLY the ISO 639-1 language code.
- Do not explain.
- Do not use markdown.
- Do not return JSON.
- Do not return anything except the language code.

Examples:

Hello, how are you?
en

Bonjour tout le monde
fr

Hola amigo
es

Ẹ káàárọ̀
yo

Sannu
ha

${text}
`;
}

function buildTranslatePrompt(
  message,
  targetLanguage
) {
  const targetLanguageName =
    getLanguageName(targetLanguage);

  return `
You are MKJ Chat's professional AI translation engine.

Translate the following message into ${targetLanguageName}.

Rules:

- First detect the message language.
- If the message is already written in ${targetLanguageName},
  return the original text unchanged.
- Preserve:
  • emojis
  • URLs
  • phone numbers
  • email addresses
  • usernames
  • hashtags
  • markdown
  • punctuation
- Never explain.
- Never add notes.
- Never add quotation marks.
- Sound natural like a native speaker.

Return ONLY valid JSON.

{
  "success": true,
  "provider": "gemini",
  "detectedLanguage": "",
  "targetLanguage": "${targetLanguage}",
  "needsTranslation": true,
  "translation": ""
}

Message:

${message}
`;
}

module.exports = {
  buildDetectLanguagePrompt,
  buildTranslatePrompt
};
