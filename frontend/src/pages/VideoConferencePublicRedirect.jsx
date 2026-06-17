import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { fetchVideoPublicHint } from "../api";

/**
 * Публичный /calls/video/:sessionId — не комната Meet.
 * Всегда перенаправляет на /calls/join/:guestToken (без логина).
 */
function VideoConferencePublicRedirect() {
  const { sessionId } = useParams();
  const [hint, setHint] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVideoPublicHint(sessionId)
      .then(setHint)
      .catch((err) => setError(err.message));
  }, [sessionId]);

  if (hint?.joinUrl) {
    const joinPath = hint.joinUrl.startsWith("http") ? new URL(hint.joinUrl).pathname : hint.joinUrl;
    return <Navigate to={joinPath} replace />;
  }

  return (
    <div className="auth-page">
      <div className="auth-card video-conf-join-card">
        <h2>Видеоконференция</h2>
        {error ? <p className="hint error">{error}</p> : null}
        {hint?.message ? <p className="hint">{hint.message}</p> : null}
        {!hint && !error ? <p className="hint">Поиск ссылки конференции...</p> : null}
        <p className="hint">
          Для видеозвонка без входа в CRM используйте ссылку <strong>/calls/join/…</strong> от менеджера.
        </p>
      </div>
    </div>
  );
}

export default VideoConferencePublicRedirect;
