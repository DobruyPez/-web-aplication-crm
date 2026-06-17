import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createVideoSession, fetchClientInvitePublic } from "../api";
import { buildClientInviteUrl } from "../lib/appUrl";
import { parseClientInviteToken } from "../lib/clientInviteLink";

/**
 * Блок на странице «Видеозвонки»: вставка client-invite ссылки от клиента без открытия модалки.
 */
function ManagerIncomingVideoInvite({ onOutgoingClick }) {
  const navigate = useNavigate();
  const [clientInviteUrl, setClientInviteUrl] = useState("");
  const [invitePreview, setInvitePreview] = useState(null);
  const [invitePreviewError, setInvitePreviewError] = useState("");
  const [inviteChecking, setInviteChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inviteToken = useMemo(() => parseClientInviteToken(clientInviteUrl), [clientInviteUrl]);
  const canonicalInviteUrl = inviteToken ? buildClientInviteUrl(inviteToken) : "";

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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setClientInviteUrl(text.trim());
      }
    } catch {
      setError("Не удалось вставить из буфера обмена");
    }
  };

  const handleIncoming = async (event) => {
    event.preventDefault();
    if (!inviteToken || !invitePreview) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await createVideoSession({
        clientInviteUrl: canonicalInviteUrl || clientInviteUrl.trim(),
      });
      navigate(`/calls/video-host/${session.sessionId || session.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canStart = Boolean(inviteToken && invitePreview && !inviteChecking && !invitePreviewError);

  return (
    <section className="resource-section-card video-conf-incoming-block">
      <div className="resource-section-head">
        <h3>Входящий видеозвонок</h3>
        <p className="hint">
          Вставьте ссылку, которую клиент скопировал на странице приглашения («Скопировать ссылку для менеджера»).
        </p>
      </div>

      <form className="form" onSubmit={handleIncoming}>
        <label className="field client-invite-field form-full-width">
          <span>Ссылка от клиента</span>
          <input
            type="text"
            placeholder="https://…/client-invite/…"
            value={clientInviteUrl}
            onChange={(e) => setClientInviteUrl(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <div className="form-actions form-actions-inline">
          <button type="button" className="secondary-btn" onClick={handlePaste}>
            Вставить из буфера
          </button>
          <button type="submit" className="create-primary-btn" disabled={loading || !canStart}>
            {loading ? "Подключение…" : "Принять входящий видеозвонок"}
          </button>
        </div>

        {inviteChecking ? <p className="hint">Проверка ссылки…</p> : null}
        {invitePreviewError ? <p className="hint error">{invitePreviewError}</p> : null}
        {invitePreview ? (
          <p className="hint">
            Клиент: <strong>{invitePreview.clientName}</strong>
          </p>
        ) : null}
        {error ? <p className="hint error">{error}</p> : null}
      </form>

      <p className="hint video-conf-setup-divider">— или —</p>

      <div className="resource-section-head">
        <h3>Исходящий видеозвонок</h3>
        <p className="hint">Создайте конференцию и выберите клиента из списка.</p>
      </div>
      <button type="button" className="create-primary-btn" onClick={onOutgoingClick}>
        Начать исходящую видеоконференцию
      </button>
    </section>
  );
}

export default ManagerIncomingVideoInvite;
