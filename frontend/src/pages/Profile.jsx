import { useState } from "react";
import { authMe } from "../api";
import { useAuth } from "../authContext";

const Profile = () => {
  const { user, setUser, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const reload = async () => {
    setLoading(true);
    setStatus("");
    try {
      const profile = await authMe();
      setUser(profile);
      setStatus("Данные обновлены");
    } catch (error) {
      setStatus(error.message || "Не удалось обновить данные");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="resource-section-card">
      <div className="resource-section-head">
        <h3>Личный кабинет</h3>
        <p className="hint">Ваши данные профиля и Telegram для уведомлений.</p>
      </div>
      <div className="resource-card-grid">
        <div className="resource-kv">
          <span>ФИО</span>
          <strong>{user?.fullName || "—"}</strong>
        </div>
        <div className="resource-kv">
          <span>Email</span>
          <strong>{user?.email || "—"}</strong>
        </div>
        <div className="resource-kv">
          <span>Роль</span>
          <strong>{isAdmin ? "Администратор" : "Менеджер"}</strong>
        </div>
        <div className="resource-kv">
          <span>Телефон</span>
          <strong>{user?.phone || "—"}</strong>
        </div>
        <div className="resource-kv">
          <span>Telegram</span>
          <strong>
            {user?.telegramLink ? (
              <a href={user.telegramLink} target="_blank" rel="noreferrer">
                {user.telegramLink}
              </a>
            ) : (
              "—"
            )}
          </strong>
        </div>
        <div className="resource-kv">
          <span>Telegram Chat ID</span>
          <strong>{user?.telegramChatId || "—"}</strong>
        </div>
      </div>
      <div className="form-actions" style={{ marginTop: 14 }}>
        <button type="button" onClick={reload} disabled={loading}>
          {loading ? "Обновление..." : "Обновить профиль"}
        </button>
      </div>
      {status ? <p className="hint">{status}</p> : null}
    </section>
  );
};

export default Profile;
