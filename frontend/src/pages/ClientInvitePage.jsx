import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchClientInvitePublic, startVideoFromClientInvite } from "../api";
import { buildAbsoluteUrl, buildClientInviteUrl } from "../lib/appUrl";

function ClientInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    fetchClientInvitePublic(token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  const canonical =
    data?.canonicalAbsoluteUrl || data?.canonicalUrl
      ? data.canonicalAbsoluteUrl || buildClientInviteUrl(token)
      : buildClientInviteUrl(token);

  const copyManagerLink = async () => {
    try {
      await navigator.clipboard.writeText(canonical);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать ссылку");
    }
  };

  const startVideo = async () => {
    setVideoLoading(true);
    setError("");
    try {
      const result = await startVideoFromClientInvite(token);
      const joinPath = result.joinUrl?.startsWith("http")
        ? new URL(result.joinUrl).pathname
        : result.joinUrl || `/calls/join/${result.guestToken}`;
      navigate(joinPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <div className="auth-page client-invite-page">
      <div className="auth-layout">
        <div className="auth-card client-invite-card">
          <p className="dashboard-kicker">CRM — приглашение клиента</p>
          <h2 className="client-invite-title">Страница для клиента</h2>

          {error ? <p className="hint error">{error}</p> : null}

          {data ? (
            <>
              <p className="hint">
                Здравствуйте{data.clientName ? `, ${data.clientName}` : ""}! Выберите действие ниже.
              </p>

              <section className="resource-section-card client-invite-actions">
                <div className="resource-section-head">
                  <h3>1. Ссылка для менеджера</h3>
                  <p className="hint">
                    Отправьте менеджеру{data.managerName ? ` (${data.managerName})` : ""} в мессенджере — он вставит её
                    в CRM при входящем звонке.
                  </p>
                </div>
                <label className="field client-invite-field">
                  <span>Каноническая ссылка</span>
                  <input type="text" readOnly value={canonical} />
                </label>
                <button type="button" className="secondary-btn" onClick={copyManagerLink}>
                  {copied ? "Скопировано" : "Скопировать ссылку для менеджера"}
                </button>
              </section>

              <section className="resource-section-card client-invite-actions">
                <div className="resource-section-head">
                  <h3>2. Видеозвонок</h3>
                  <p className="hint">
                    В звонке участвуют только вы и ваш менеджер. Создаёт или открывает конференцию и переводит на{" "}
                    <code>{buildAbsoluteUrl("/calls/join/…")}</code> — без логина в CRM.
                  </p>
                </div>
                <button
                  type="button"
                  className="create-primary-btn"
                  onClick={startVideo}
                  disabled={videoLoading}
                >
                  {videoLoading ? "Подключение..." : "Войти в видеозвонок"}
                </button>
              </section>
            </>
          ) : !error ? (
            <p className="hint">Загрузка...</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ClientInvitePage;
