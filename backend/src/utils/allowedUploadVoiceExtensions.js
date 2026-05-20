const ALLOWED_UPLOAD_VOICE_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".oga",
  ".m4a",
  ".aac",
  ".webm",
  ".opus",
];

const isAllowedVoiceExtension = (ext) =>
  ALLOWED_UPLOAD_VOICE_EXTENSIONS.includes(String(ext || "").toLowerCase());

const UPLOAD_VOICE_REJECT_MESSAGE = `Допускаются только аудиофайлы (${[...ALLOWED_UPLOAD_VOICE_EXTENSIONS].sort().join(", ")}).`;

module.exports = {
  ALLOWED_UPLOAD_VOICE_EXTENSIONS,
  isAllowedVoiceExtension,
  UPLOAD_VOICE_REJECT_MESSAGE,
};
