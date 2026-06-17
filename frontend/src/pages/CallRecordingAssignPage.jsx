import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteUploadedVoiceFileFromServer,
  fetchUploadedVoiceFiles,
  uploadVoiceFileToServer,
} from "../api";
import { useAuth } from "../authContext";
import { API_ORIGIN, UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS } from "../config";
import VideoConferenceSetupModal from "../components/VideoConferenceSetupModal";
import ManagerIncomingVideoInvite from "../components/ManagerIncomingVideoInvite";

const audioHref = (filePath) => (filePath ? encodeURI(`${API_ORIGIN}${filePath}`) : "#");

/** Менеджер: только видеоконференции (без upload/voice list). */
function ManagerVideoCallsPanel() {
  const navigate = useNavigate();
  const [setupOpen, setSetupOpen] = useState(false);

  const onSessionStarted = (session) => {
    navigate(`/calls/video-host/${session.sessionId || session.id}`);
  };

  return (
    <div className="frame-page doc-upload-page">
      <header className="doc-upload-head">
        <div>
          <p className="hint">
            Видеоконференция с автозаписью и автоматическим созданием звонка после завершения сессии. Рекомендуется браузер
            Google Chrome.
          </p>
        </div>
      </header>

      <ManagerIncomingVideoInvite onOutgoingClick={() => setSetupOpen(true)} />

      <section className="resource-section-card" style={{ marginTop: 16 }}>
        <p className="hint" style={{ margin: 0 }}>
          До 10 участников в комнате. Запись начинается, когда подключится второй участник. Готовые звонки — в разделе
          «Звонки». Рекомендуется Google Chrome.
        </p>
      </section>

      <VideoConferenceSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} onStarted={onSessionStarted} />
    </div>
  );
}

/** Админ: ручная загрузка голосовых файлов (без старта видеосессии). */
function AdminVoiceUploadPanel() {
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
          <p className="hint">
            Голосовые файлы хранятся на сервере в `uploads/voice`, а в БД сохраняется относительный путь. Создание звонков
            — в разделе «Звонки».
          </p>
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
          <p className="hint">
            Администратор может подключиться к видеосессии по guest-ссылке менеджера (режим наблюдателя, без записи).
          </p>
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

function CallRecordingAssignPage() {
  const { user, isAdmin, isManager, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="frame-page doc-upload-page">
        <p className="hint">Загрузка профиля...</p>
      </div>
    );
  }

  if (isManager && !isAdmin) {
    return <ManagerVideoCallsPanel />;
  }

  if (isAdmin) {
    return <AdminVoiceUploadPanel />;
  }

  return (
    <div className="frame-page doc-upload-page">
      <p className="hint error">Неизвестная роль: {user?.role ?? "—"}</p>
    </div>
  );
}

export default CallRecordingAssignPage;
