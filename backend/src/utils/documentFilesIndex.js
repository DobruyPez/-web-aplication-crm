const fs = require("fs");
const { DOCS_DIR, INDEX_FILE, ensureDocsDir } = require("./uploadsPaths");

const readIndex = () => {
  ensureDocsDir();
  if (!fs.existsSync(INDEX_FILE)) {
    return { files: [] };
  }
  try {
    const raw = fs.readFileSync(INDEX_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.files)) {
      return { files: [] };
    }
    return data;
  } catch (_error) {
    return { files: [] };
  }
};

const writeIndex = (data) => {
  ensureDocsDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), "utf8");
};

const upsertFileEntry = (entry) => {
  const index = readIndex();
  const next = index.files.filter((f) => f.filename !== entry.filename);
  next.push(entry);
  index.files = next.sort((a, b) => String(a.filename).localeCompare(String(b.filename)));
  writeIndex(index);
};

const removeFileEntry = (filename) => {
  const index = readIndex();
  index.files = index.files.filter((f) => f.filename !== filename);
  writeIndex(index);
};

module.exports = {
  readIndex,
  writeIndex,
  upsertFileEntry,
  removeFileEntry,
  DOCS_DIR,
};
