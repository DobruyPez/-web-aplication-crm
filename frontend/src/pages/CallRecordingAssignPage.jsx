import { useCallback, useEffect, useState } from "react";
import { deleteUploadedVoiceFileFromServer, fetchUploadedVoiceFiles, uploadVoiceFileToServer } from "../api";
import { API_ORIGIN, UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS } from "../config";

const audioHref = (filePath) => (filePath ? encodeURI(`${API_ORIGIN}${filePath}`) : "#");

function CallRecordingAssignPage() {
  const [voiceFiles, setVoiceFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const voiceRows = await fetchUploadedVoiceFiles();
      setVoiceFiles(voiceRows);
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const onUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setErrorText("");
    setStatusText("");
    try {
      await uploadVoiceFileToServer(file, UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS);
      await reload();
      setStatusText("Аудиофайл загружен.");
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteVoice = async (filename) => {
    if (!window.confirm(`Удалить голосовой файл «${filename}»?`)) return;
    setErrorText("");
    setStatusText("");
    try {
      await deleteUploadedVoiceFileFromServer(filename);
      await reload();
      setStatusText("Голосовой файл удален.");
    } catch (error) {
      setErrorText(error.message);
    }
  };

  return (
    <div className="frame-page doc-upload-page">
      <header className="doc-upload-head">
        <div>
          <p className="hint">Голосовые файлы хранятся на сервере в `uploads/voice`, а в БД сохраняется относительный путь.</p>
        </div>
        <button type="button" className="refresh-btn modern-btn" onClick={reload} disabled={loading || uploading}>
          Обновить
        </button>
      </header>

      {errorText ? <p className="hint error">{errorText}</p> : null}
      {statusText ? <p className="hint">{statusText}</p> : null}

      <section className="resource-section-card">
        <div className="resource-section-head">
          <h3>Загрузка голосового файла</h3>
        </div>
        <label className="doc-upload-file-btn">
          <input type="file" disabled={uploading} onChange={onUploadFile} />
          {uploading ? "Загрузка..." : "Выбрать аудиофайл"}
        </label>
      </section>

      <section className="resource-section-card">
        <div className="resource-section-head">
          <h3>Голосовые файлы ({voiceFiles.length})</h3>
        </div>
        <div className="doc-upload-cards">
          {voiceFiles.map((voice) => (
            <article key={voice.filename} className="resource-card doc-upload-card">
              <div className="resource-card-grid">
                <div className="resource-kv">
                  <span>Файл</span>
                  <strong>{voice.filename}</strong>
                </div>
                <div className="resource-kv">
                  <span>Прослушать</span>
                  <strong>
                    <audio controls className="call-audio-table" src={audioHref(voice.filePath)}>
                      <a href={audioHref(voice.filePath)} target="_blank" rel="noreferrer">
                        Открыть запись
                      </a>
                    </audio>
                  </strong>
                </div>
              </div>
              <footer className="doc-upload-card-actions">
                <button type="button" className="doc-upload-delete-btn" onClick={() => deleteVoice(voice.filename)}>
                  Удалить
                </button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CallRecordingAssignPage;
