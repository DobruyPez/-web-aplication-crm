import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import VideoConferenceRoom from "../components/VideoConferenceRoom";
import { fetchVideoJoinMeta } from "../api";
import { buildJoinUrl } from "../lib/appUrl";
import { useVideoConference } from "../hooks/useVideoConference";

/** Клиент-гость: только вход по /calls/join/:guestToken без JWT. */
function VideoConferenceJoinPage() {
  const { guestToken } = useParams();
  const [meta, setMeta] = useState(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const peerId = useMemo(() => `client-${guestToken.slice(0, 8)}`, [guestToken]);

  useEffect(() => {
    fetchVideoJoinMeta(guestToken)
      .then(setMeta)
      .catch((err) => setError(err.message));
  }, [guestToken]);

  const conference = useVideoConference({
    guestToken: joined ? guestToken : null,
    peerId: joined ? peerId : null,
    isManager: false,
    canRecord: false,
  });

  const previewRef = useRef(null);

  useEffect(() => {
    if (!joined) return undefined;
    let stream;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        stream = s;
        if (previewRef.current) {
          previewRef.current.srcObject = s;
        }
      })
      .catch((err) => setError(err.message));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [joined]);

  const statusChip = conference.clientConnected
    ? "В эфире"
    : meta?.clientName
      ? `Клиент: ${meta.clientName}`
      : "Подключение";

  if (!joined) {
    return (
      <div className="auth-page video-conf-join-page">
        <div className="auth-card video-conf-join-card">
          <h2>Видеоконференция</h2>
          <p className="hint">
            Ссылка конференции:{" "}
            <span className="video-conf-join-link">{buildJoinUrl(guestToken)}</span>
          </p>
          {meta ? <p className="hint">В звонке участвуют только вы и ваш менеджер.</p> : null}
          {error ? <p className="hint error">{error}</p> : null}
          <video ref={previewRef} className="video-conf-join-preview" autoPlay playsInline muted />
          <button type="button" className="create-primary-btn" onClick={() => setJoined(true)} disabled={!meta}>
            Войти в конференцию
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="frame-page doc-upload-page video-conf-page video-conf-join-active">
      <VideoConferenceRoom
        localStream={conference.localStream}
        remoteStream={conference.remoteStream}
        statusChip={statusChip}
        micEnabled={conference.micEnabled}
        cameraEnabled={conference.cameraEnabled}
        onToggleMic={conference.toggleMic}
        onToggleCamera={conference.toggleCamera}
        isManager={false}
        error={conference.error || error}
      />
    </div>
  );
}

export default VideoConferenceJoinPage;
