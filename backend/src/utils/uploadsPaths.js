const path = require("path");
const fs = require("fs");

const UPLOADS_ROOT = path.join(__dirname, "../../uploads");
const DOCS_DIR = path.join(UPLOADS_ROOT, "docs");
const VOICE_DIR = path.join(UPLOADS_ROOT, "voice");
const INDEX_FILE = path.join(DOCS_DIR, ".files-index.json");
const VOICE_INDEX_FILE = path.join(VOICE_DIR, ".files-index.json");

const ensureDocsDir = () => {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
};

const ensureVoiceDir = () => {
  if (!fs.existsSync(VOICE_DIR)) {
    fs.mkdirSync(VOICE_DIR, { recursive: true });
  }
};

module.exports = {
  UPLOADS_ROOT,
  DOCS_DIR,
  VOICE_DIR,
  INDEX_FILE,
  VOICE_INDEX_FILE,
  ensureDocsDir,
  ensureVoiceDir,
};
