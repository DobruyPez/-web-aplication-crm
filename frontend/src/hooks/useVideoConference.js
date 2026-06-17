import { useCallback, useEffect, useRef, useState } from "react";
import {
  startDomRegionRecorder,
  waitForRecordingTracks,
  waitForVideoTrackInStream,
} from "../lib/domRegionRecorder";
import { streamTracksSummary, videoRecordLog } from "../lib/videoRecordLogger";

export const MAX_ROOM_PARTICIPANTS = 2;
const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const wsOrigin = () => {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return base.replace(/^http/i, (m) => (m.toLowerCase() === "https" ? "wss" : "ws"));
};

export function useVideoConference({
  guestToken,
  peerId,
  isManager = false,
  canRecord = false,
  recordRegionRef = null,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [sessionStatus, setSessionStatus] = useState("waiting");
  const [error, setError] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [recordingBlob, setRecordingBlob] = useState(null);

  const wsRef = useRef(null);
  const peerPcRef = useRef(null);
  const remotePeerIdRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const recorderStopRef = useRef(null);
  const recordingStartingRef = useRef(false);

  const stopActiveRecording = useCallback(() => {
    if (recorderStopRef.current) {
      recorderStopRef.current().catch(() => {});
      recorderStopRef.current = null;
    }
    recordingStartingRef.current = false;
    setSessionStatus((status) => (status === "recording" ? "waiting" : status));
  }, []);

  const ensureSinglePeer = useCallback((remotePeerId, ws) => {
    if (remotePeerIdRef.current && remotePeerIdRef.current !== remotePeerId) {
      return null;
    }
    if (peerPcRef.current) {
      return peerPcRef.current;
    }
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    peerPcRef.current = pc;
    remotePeerIdRef.current = remotePeerId;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(
          JSON.stringify({
            type: "ice",
            to: remotePeerId,
            candidate: event.candidate,
          }),
        );
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      if (!track) {
        return;
      }
      videoRecordLog("webrtc", "ontrack", {
        kind: track.kind,
        id: track.id,
        state: track.readyState,
        isManager,
      });
      let stream = remoteStreamRef.current;
      if (!stream) {
        stream = event.streams?.[0] ?? new MediaStream();
        remoteStreamRef.current = stream;
      }

      const sameKind = stream.getTracks().filter((t) => t.kind === track.kind);
      sameKind.forEach((t) => {
        if (t.id !== track.id) {
          stream.removeTrack(t);
        }
      });
      if (!stream.getTracks().some((t) => t.id === track.id)) {
        stream.addTrack(track);
      }

      remoteStreamRef.current = stream;
      setRemoteStream(new MediaStream(stream.getTracks()));
    };

    return pc;
  }, []);

  const startRecordingIfReady = useCallback(async () => {
    if (
      !canRecord ||
      recorderStopRef.current ||
      recordingStartingRef.current ||
      participantCount < 2 ||
      !remoteStreamRef.current
    ) {
      return;
    }

    const container = recordRegionRef?.current;
    if (!container) {
      return;
    }

    recordingStartingRef.current = true;

    try {
      videoRecordLog("hook", "startRecordingIfReady", {
        participantCount,
        local: streamTracksSummary(localStreamRef.current, "local"),
        remote: streamTracksSummary(remoteStreamRef.current, "remote"),
      });
      await waitForVideoTrackInStream(remoteStreamRef.current, 20000);
      await waitForRecordingTracks(localStreamRef.current, remoteStreamRef.current, 20000);

      if (recorderStopRef.current || !remoteStreamRef.current || participantCount < 2) {
        return;
      }

      const { stop } = startDomRegionRecorder(container, {
        audioStreams: [localStreamRef.current, remoteStreamRef.current],
        videoStreams: {
          local: localStreamRef.current,
          remote: remoteStreamRef.current,
        },
      });
      recorderStopRef.current = stop;
      setSessionStatus("recording");
      videoRecordLog("hook", "recording active", { status: "recording" });
    } catch (err) {
      videoRecordLog("hook", "startRecording failed", { error: err.message });
      setError(err.message || "Не удалось начать запись");
    } finally {
      recordingStartingRef.current = false;
    }
  }, [canRecord, participantCount, recordRegionRef]);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (
      !canRecord ||
      participantCount < 2 ||
      !remoteStream ||
      sessionStatus !== "waiting" ||
      recorderStopRef.current ||
      recordingStartingRef.current
    ) {
      return;
    }
    startRecordingIfReady();
  }, [participantCount, remoteStream, canRecord, sessionStatus, startRecordingIfReady]);

  useEffect(() => {
    if (!guestToken || !peerId) {
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = media;
        setLocalStream(media);

        const crmToken = isManager ? localStorage.getItem("crm_auth_token") : null;
        let wsUrl = `${wsOrigin()}/ws/video?guestToken=${encodeURIComponent(guestToken)}&peerId=${encodeURIComponent(peerId)}`;
        if (!isManager) {
          wsUrl += "&role=guest";
        } else if (crmToken) {
          wsUrl += `&access_token=${encodeURIComponent(crmToken)}`;
        }
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = async (event) => {
          let msg;
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }

          if (msg.type === "error") {
            setError(msg.message || "Ошибка сигналинга");
            if (msg.code === 409 || msg.code === 403) {
              ws.close();
            }
            return;
          }

          if (msg.type === "joined") {
            setError("");
          }

          if (msg.type === "joined" || msg.type === "peer-joined" || msg.type === "peer-left") {
            const count = msg.participantCount ?? participantCount;
            setParticipantCount(count);
          }

          if (msg.type === "peers" && Array.isArray(msg.peers) && msg.peers.length > 0) {
            const remoteId = msg.peers[0];
            ensureSinglePeer(remoteId, ws);
          }

          if (msg.type === "sdp" && msg.from) {
            const pc = ensureSinglePeer(msg.from, ws);
            if (!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            if (msg.sdp.type === "offer") {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: "sdp", to: msg.from, sdp: pc.localDescription }));
            }
          }

          if (msg.type === "ice" && msg.from && msg.candidate) {
            const pc = peerPcRef.current;
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
          }

          if (msg.type === "peer-joined" && msg.peerId && msg.peerId !== peerId) {
            if (remotePeerIdRef.current && remotePeerIdRef.current !== msg.peerId) {
              setError("В звонке могут быть только менеджер и клиент.");
              return;
            }
            const pc = ensureSinglePeer(msg.peerId, ws);
            if (pc && isManager) {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ type: "sdp", to: msg.peerId, sdp: pc.localDescription }));
            }
          }

          if (msg.type === "peer-left") {
            stopActiveRecording();
            remoteStreamRef.current = null;
            setRemoteStream(null);
            remotePeerIdRef.current = null;
            if (peerPcRef.current) {
              peerPcRef.current.close();
              peerPcRef.current = null;
            }
          }
        };

        ws.onerror = () => setError("Ошибка WebSocket");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Не удалось подключиться к конференции");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      stopActiveRecording();
      wsRef.current?.close();
      if (peerPcRef.current) {
        peerPcRef.current.close();
        peerPcRef.current = null;
      }
      remotePeerIdRef.current = null;
      remoteStreamRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestToken, peerId, isManager, stopActiveRecording]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicEnabled((v) => !v);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCameraEnabled((v) => !v);
  };

  const stopRecording = async () => {
    if (recorderStopRef.current) {
      const blob = await recorderStopRef.current();
      recorderStopRef.current = null;
      recordingStartingRef.current = false;
      setRecordingBlob(blob);
      return blob;
    }
    return recordingBlob;
  };

  const remoteStreamsForUi = remoteStream ? { [remotePeerIdRef.current || "remote"]: remoteStream } : {};

  return {
    localStream,
    remoteStream,
    remoteStreams: remoteStreamsForUi,
    participantCount,
    sessionStatus,
    setSessionStatus,
    error,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    recordingBlob,
    stopRecording,
    maxParticipants: MAX_ROOM_PARTICIPANTS,
    clientConnected: Boolean(remoteStream),
  };
}
