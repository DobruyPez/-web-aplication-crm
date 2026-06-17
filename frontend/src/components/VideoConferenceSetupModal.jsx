import { useEffect, useMemo, useState } from "react";
import { createVideoSession, fetchClientInvitePublic, fetchList } from "../api";
import { buildClientInviteUrl } from "../lib/appUrl";
import { parseClientInviteToken } from "../lib/clientInviteLink";

/**
 * Два сценария:
 * 1) Входящий — менеджер вставляет client-invite URL, который клиент скопировал со страницы приглашения.
 * 2) Исходящий — менеджер выбирает клиента из списка.
 */
function VideoConferenceSetupModal({ open, onClose, onStarted }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [clientInviteUrl, setClientInviteUrl] = useState("");
  const [invitePreview, setInvitePreview] = useState(null);
  const [invitePreviewError, setInvitePreviewError] = useState("");
  const [inviteChecking, setInviteChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inviteToken = useMemo(() => parseClientInviteToken(clientInviteUrl), [clientInviteUrl]);
  const useInviteLink = Boolean(inviteToken);
  const canonicalInviteUrl = inviteToken ? buildClientInviteUrl(inviteToken) : "";

  useEffect(() => {
    if (!open) {
      return;
    }
    setClientId("");
    setClientInviteUrl("");
    setInvitePreview(null);
    setInvitePreviewError("");
    setError("");
    fetchList("clients")
      .then((rows) => setClients(rows))
      .catch((err) => setError(err.message));
  }, [open]);

  useEffect(() => {
    if (!inviteToken) {
      setInvitePreview(null);
      setInvitePreviewError("");
      setInviteChecking(false);
      return;
    }
    let cancelled = false;
    setInviteChecking(true);
    setInvitePreviewError("");
    fetchClientInvitePublic(inviteToken)
      .then((data) => {
        if (!cancelled) {
          setInvitePreview(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setInvitePreview(null);
          setInvitePreviewError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInviteChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  if (!open) {
    return null;
  }

  const handlePasteInvite = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setClientInviteUrl(text.trim());
        setClientId("");
      }
    } catch {
      setError("Не удалось вставить из буфера обмена");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = useInviteLink
        ? await createVideoSession({ clientInviteUrl: canonicalInviteUrl || clientInviteUrl.trim() })
        : await createVideoSession({ clientId: Number(clientId) });
      onStarted(session);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmitIncoming = useInviteLink && invitePreview && !inviteChecking && !invitePreviewError;
  const canSubmitOutgoing = !useInviteLink && Boolean(clientId);
  const canSubmit = canSubmitIncoming || canSubmitOutgoing;

  return (
    <div className="video-conf-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="resource-section-card video-conf-modal-panel video-conf-setup-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-conf-setup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="resource-section-head">
          <h3 id="video-conf-setup-title">Настройка видеосессии</h3>
        </div>

        <form className="form video-conf-setup-form" onSubmit={handleSubmit}>
          <section className="video-conf-setup-block">
            <h4>1. Входящий видеозвонок (ссылка от клиента)</h4>
            <p className="hint">
              Клиент открыл страницу приглашения (<code>/client-invite/…</code>), нажал «Скопировать ссылку для
              менеджера» и прислал вам в мессенджере. Вставьте её ниже.
            </p>

            <label className="field client-invite-field form-full-width">
              <span>Каноническая ссылка от клиента</span>
              <input
                type="text"
                placeholder="https://localhost:4443/client-invite/…"
                value={clientInviteUrl}
                onChange={(e) => {
                  setClientInviteUrl(e.target.value);
                  if (e.target.value.trim()) {
                    setClientId("");
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <div className="form-actions form-actions-inline">
              <button type="button" className="secondary-btn" onClick={handlePasteInvite}>
                Вставить из буфера
              </button>
            </div>

            {inviteChecking ? <p className="hint">Проверка ссылки…</p> : null}
            {invitePreviewError ? <p className="hint error">{invitePreviewError}</p> : null}
            {invitePreview ? (
              <p className="hint video-conf-invite-ok">
                Распознан клиент: <strong>{invitePreview.clientName}</strong>
                {invitePreview.managerName ? ` · ваш менеджер в ссылке: ${invitePreview.managerName}` : ""}
              </p>
            ) : null}
            {canonicalInviteUrl && invitePreview ? (
              <label className="field client-invite-field form-full-width">
                <span>Будет использована ссылка</span>
                <input type="text" readOnly value={canonicalInviteUrl} />
              </label>
            ) : null}
          </section>

          <p className="hint video-conf-setup-divider">— или исходящий звонок —</p>

          <section className="video-conf-setup-block">
            <h4>2. Исходящий видеозвонок</h4>
            <p className="hint">Выберите клиента из списка — создаётся новая исходящая конференция.</p>

            <label className="field form-full-width">
              <span>Клиент</span>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  if (e.target.value) {
                    setClientInviteUrl("");
                  }
                }}
                disabled={useInviteLink}
              >
                <option value="">Выберите клиента</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {error ? <p className="hint error form-full-width">{error}</p> : null}

          <div className="form-actions">
            <button type="button" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="create-primary-btn" disabled={loading || !canSubmit}>
              {loading
                ? "Создание…"
                : canSubmitIncoming
                  ? "Принять входящий видеозвонок"
                  : "Начать видеоконференцию"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VideoConferenceSetupModal;
