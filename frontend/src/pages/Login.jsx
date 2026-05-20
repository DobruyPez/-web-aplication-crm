import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { authLogin } from "../api";
import { useAuth } from "../authContext";
import { toAppLocation } from "../lib/appLocation.js";

/** Внутренний путь SPA после входа (pathname + query), без open-redirect. */
function safeAppReturnTo(raw) {
  if (raw == null || raw === "") return null;
  let decoded;
  try {
    decoded = decodeURIComponent(String(raw));
  } catch {
    return null;
  }
  if (typeof decoded !== "string" || !decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("..")) {
    return null;
  }
  const pathOnly = decoded.split(/[?#]/)[0];
  if (pathOnly === "/login") return null;
  return decoded;
}

const Login = () => {
  const { login, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (token) {
    const dest = safeAppReturnTo(searchParams.get("returnTo")) || "/";
    return <Navigate to={toAppLocation(dest)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await authLogin({ email, password });
      if (data.token && data.user) {
        login(data.token, data.user);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <aside className="auth-side">
          <p className="dashboard-kicker">CRM Workspace</p>
          <h2>Управляйте клиентами, сделками и задачами в одном окне.</h2>
          <p>Единая панель для менеджера и администратора с прозрачной операционной картиной.</p>
        </aside>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Вход</h1>
          <p className="hint">Доступ по учётным данным, которые выдал администратор.</p>
          {error ? <p className="hint error">{error}</p> : null}
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          <button type="submit">Войти</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
