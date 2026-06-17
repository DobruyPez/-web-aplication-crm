import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import VideoConferenceRoom from "../components/VideoConferenceRoom";
import { endVideoSession, fetchVideoSession, uploadVideoSessionRecording } from "../api";
import { resolveGuestJoinUrl } from "../lib/appUrl";
import { useVideoConference } from "../hooks/useVideoConference";
import { clearVideoRecordLogs, downloadVideoRecordLogs } from "../lib/videoRecordLogger";

function VideoConferencePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [ending, setEnding] = useState(false);

  const peerId = useMemo(() => `manager-${sessionId}`, [sessionId]);
  const recordRegionRef = useRef(null);

  const conference = useVideoConference({
    guestToken: session?.guestToken,
    peerId,
    isManager: true,
    canRecord: true,
    recordRegionRef,
  });

  useEffect(() => {
    fetchVideoSession(sessionId)
      .then(setSession)
      .catch((err) => setLoadError(err.message));
  }, [sessionId]);

  const statusChip =
    conference.sessionStatus === "recording"
      ? "Запись"
      : conference.clientConnected
        ? "Клиент в эфире"
        : "Ожидание клиента";

  const guestLink = resolveGuestJoinUrl(session);

  const copyGuestLink = async () => {
    if (!guestLink) return;
    await navigator.clipboard.writeText(guestLink);
  };

  const handleEnd = async () => {
    if (!window.confirm("Завершить видеосессию и сохранить запись?")) return;
    setEnding(true);
    try {
      const blob = await conference.stopRecording();
      if (blob && blob.size > 0) {
        await uploadVideoSessionRecording(sessionId, blob);
      }
      await endVideoSession(sessionId);
      conference.setSessionStatus("ended");
      navigate("/calls/create");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setEnding(false);
    }
  };

  if (loadError) {
    return (
      <div className="frame-page doc-upload-page">
        <p className="hint error">{loadError}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="frame-page doc-upload-page">
        <p className="hint">Загрузка сессии...</p>
      </div>
    );
  }

  return (
    <div className="frame-page doc-upload-page video-conf-page">
      <VideoConferenceRoom
        recordRegionRef={recordRegionRef}
        localStream={conference.localStream}
        remoteStream={conference.remoteStream}
        statusChip={statusChip}
        guestLink={guestLink}
        guestLinkHint="Ссылка только для одного клиента. В звонке участвуют только вы и клиент."
        onCopyLink={copyGuestLink}
        isManager
        micEnabled={conference.micEnabled}
        cameraEnabled={conference.cameraEnabled}
        onToggleMic={conference.toggleMic}
        onToggleCamera={conference.toggleCamera}
        onEndSession={handleEnd}
        canEnd
        error={conference.error}
      />
      {ending ? <p className="hint">Сохранение записи...</p> : null}
      <p className="hint video-conf-log-hint">
        Лог записи: F12 → Консоль, фильтр <code>[VideoRecord]</code>. Скачать JSON:{" "}
        <button type="button" className="secondary-btn" onClick={() => downloadVideoRecordLogs()}>
          Скачать лог
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            clearVideoRecordLogs();
            window.alert("Лог очищен. Проведите звонок заново.");
          }}
        >
          Очистить
        </button>
        . Для файла на сервере откройте с <code>?videoRecordDebug=1</code> в URL.
      </p>
    </div>
  );
}

export default VideoConferencePage;
