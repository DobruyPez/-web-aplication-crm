import { useEffect, useRef } from "react";

function VideoTile({ stream, label, videoSlot, placeholder }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) {
      return undefined;
    }
    el.srcObject = stream;
    el.muted = true;
    const play = () => {
      el.play().catch(() => {});
    };
    play();
    el.addEventListener("loadedmetadata", play);
    el.addEventListener("resize", play);
    return () => {
      el.removeEventListener("loadedmetadata", play);
      el.removeEventListener("resize", play);
    };
  }, [stream]);

  return (
    <div className="video-conf-tile video-conf-tile-duo" data-video-slot={videoSlot}>
      {stream ? (
        <video ref={ref} autoPlay playsInline muted />
      ) : (
        <div className="video-conf-tile-placeholder">{placeholder || "Ожидание…"}</div>
      )}
      {label ? <span className="video-conf-tile-label">{label}</span> : null}
    </div>
  );
}

function VideoConferenceRoom({
  localStream,
  remoteStream,
  remoteStreams,
  recordRegionRef,
  statusChip,
  guestLink,
  guestLinkHint,
  onCopyLink,
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  onEndSession,
  canEnd = false,
  isManager = false,
  error,
}) {
  const remote =
    remoteStream ||
    (remoteStreams && Object.values(remoteStreams).find(Boolean)) ||
    null;

  const remoteLabel = isManager ? "Клиент" : "Менеджер";
  const waitingLabel = isManager ? "Ожидание клиента" : "Ожидание менеджера";

  return (
    <div className="video-conf-room">
      <div className="video-conf-head">
        {statusChip ? <span className="spa-topbar-chip">{statusChip}</span> : null}
      </div>

      {error ? <p className="hint error">{error}</p> : null}

      <div
        ref={recordRegionRef}
        className="video-conf-grid video-conf-grid-duo video-conf-record-region"
        data-testid="video-record-region"
      >
        <VideoTile stream={localStream} label="Вы" videoSlot="local" placeholder="Камера" />
        <VideoTile
          stream={remote}
          label={remote ? remoteLabel : waitingLabel}
          videoSlot="remote"
          placeholder={waitingLabel}
        />
      </div>

      {guestLink ? (
        <div className="video-conf-guest-bar resource-kv">
          <span>Ссылка для клиента</span>
          {guestLinkHint ? <p className="hint">{guestLinkHint}</p> : null}
          <div className="video-conf-guest-row">
            <input className="field input" type="text" readOnly value={guestLink} />
            <button type="button" className="secondary-btn" onClick={onCopyLink}>
              Копировать
            </button>
          </div>
        </div>
      ) : null}

      <footer className="video-conf-controls">
        <button type="button" className="video-conf-control-btn" onClick={onToggleMic}>
          {micEnabled ? "Микрофон вкл." : "Микрофон выкл."}
        </button>
        <button type="button" className="video-conf-control-btn" onClick={onToggleCamera}>
          {cameraEnabled ? "Камера вкл." : "Камера выкл."}
        </button>
        {canEnd ? (
          <button type="button" className="doc-upload-delete-btn" onClick={onEndSession}>
            Завершить сессию
          </button>
        ) : null}
      </footer>
    </div>
  );
}

export default VideoConferenceRoom;
