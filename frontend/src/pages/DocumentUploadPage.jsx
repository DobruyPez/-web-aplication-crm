import { useCallback, useEffect, useState } from "react";
import {
  assertAllowedManagementUploadName,
  deleteUploadedDocFileFromServer,
  fetchUploadedDocFiles,
  uploadDocFileToServer,
} from "../api";
import { API_ORIGIN, UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS } from "../config";

const fileDownloadHref = (filePath) =>
  filePath ? encodeURI(`${API_ORIGIN}${filePath}`) : "#";

const formatBytes = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v < 1024) return `${v} Б`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} КБ`;
  return `${(v / (1024 * 1024)).toFixed(1)} МБ`;
};

function DocumentUploadPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingName, setDeletingName] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const allowedHint = UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS.join(", ");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const serverFiles = await fetchUploadedDocFiles();
      setFiles(serverFiles);
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const validateFileList = (fileList) => {
    const list = Array.from(fileList || []).filter(Boolean);
    for (const file of list) {
      assertAllowedManagementUploadName(file.name, UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS);
    }
    return list;
  };

  const uploadFiles = async (fileList) => {
    let list;
    try {
      list = validateFileList(fileList);
    } catch (validationError) {
      setErrorText(validationError.message);
      return;
    }
    if (list.length === 0) {
      setErrorText("Выберите файл или перетащите его в область загрузки.");
      return;
    }
    setUploading(true);
    setErrorText("");
    try {
      for (const file of list) {
        await uploadDocFileToServer(file, UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS);
      }
      await loadAll();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    uploadFiles(event.dataTransfer.files);
  };

  const onPickFiles = (event) => {
    uploadFiles(event.target.files);
    event.target.value = "";
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Удалить файл «${filename}» с сервера? Это действие нельзя отменить.`)) {
      return;
    }
    setDeletingName(filename);
    setErrorText("");
    try {
      await deleteUploadedDocFileFromServer(filename);
      await loadAll();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="frame-page doc-upload-page">
      <header className="doc-upload-head">
        <div>
          <h1>Управление документами</h1>
          <p className="hint">
            Файлы сохраняются в каталоге сервера uploads/docs. Для записей CRM на вкладке «Документы» можно выбрать только
            загруженные здесь файлы. Принимаются расширения: {allowedHint}.
          </p>
        </div>
        <button type="button" className="refresh-btn modern-btn" onClick={loadAll} disabled={loading || uploading}>
          Обновить список
        </button>
      </header>

      {errorText ? <p className="hint error">{errorText}</p> : null}
      {loading ? <p className="hint">Загрузка...</p> : null}

      <section className="doc-upload-add">
        <h2>Загрузить файл</h2>
        <p className="hint">Допускаются только файлы с расширениями {allowedHint} (без учёта регистра).</p>

        <div
          className={`doc-upload-dropzone ${dragActive ? "active" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          role="presentation"
        >
          <p>{uploading ? "Загрузка…" : "Перетащите файл сюда или выберите с устройства"}</p>
          <label className="doc-upload-file-btn">
            <input
              type="file"
              accept={[...UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS, "application/pdf"].join(",")}
              disabled={uploading}
              onChange={onPickFiles}
            />
            Выбрать файл
          </label>
        </div>
      </section>

      <section className="doc-upload-list-section">
        <h2>Файлы на сервере ({files.length})</h2>
        <div className="doc-upload-cards">
          {files.length === 0 && !loading ? <p className="hint">Пока нет загруженных файлов.</p> : null}
          {files.map((file) => (
            <article key={file.filename} className="resource-card doc-upload-card">
              <header className="resource-card-header">
                <h3>{file.filename}</h3>
              </header>
              <div className="resource-card-grid">
                <div className="resource-kv">
                  <span>Размер</span>
                  <strong>{formatBytes(file.fileSize)}</strong>
                </div>
                <div className="resource-kv">
                  <span>Тип</span>
                  <strong>{file.mimeType || "—"}</strong>
                </div>
                <div className="resource-kv">
                  <span>Ссылка</span>
                  <strong>
                    <a href={fileDownloadHref(file.filePath)} target="_blank" rel="noreferrer">
                      Открыть
                    </a>
                  </strong>
                </div>
              </div>
              <footer className="doc-upload-card-actions">
                <button
                  type="button"
                  className="doc-upload-delete-btn"
                  disabled={uploading || deletingName === file.filename}
                  onClick={() => handleDelete(file.filename)}
                >
                  {deletingName === file.filename ? "Удаление…" : "Удалить"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DocumentUploadPage;
