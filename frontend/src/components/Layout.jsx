import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../authContext";

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  const titleByPath = {
    "/": "Главная панель",
    "/clients": "Клиенты",
    "/deals": "Сделки",
    "/tasks": "Задачи",
    "/calls": "Звонки",
    "/calls/create": "Записи звонков",
    "/calls/video": "Видеоконференция",
    "/documents/upload": "Загрузка документов",
    "/documents": "Документы",
    "/profile": "Личный кабинет",
    "/users": "Пользователи",
  };
  const assignRecordingTitle = isAdmin ? "Управление звонками" : "Видеозвонки";
  const currentTitle =
    (location.pathname === "/calls/assign-recording" ? assignRecordingTitle : titleByPath[location.pathname]) ||
    (location.pathname.startsWith("/calls/video-host/") ? "Видеоконференция" : "CRM");

  const navClass = ({ isActive }) => `spa-nav-link${isActive ? " active" : ""}`;
  const callsSectionActive = location.pathname === "/calls" || location.pathname.startsWith("/calls/");
  const callsNavClass = ({ isActive }) => `spa-nav-link${isActive || callsSectionActive ? " active" : ""}`;

  return (
    <div className="spa-shell">
      <aside className="spa-sidebar">
        <div className="spa-brand">
          <span className="spa-brand-logo">CRM</span>
          <div>
            <strong>Рабочее место</strong>
            <p>{isAdmin ? "Консоль администратора" : "Консоль менеджера"}</p>
          </div>
        </div>

        <nav className="spa-nav">
          <NavLink to="/" end className={navClass}>
            Главная
          </NavLink>
          <NavLink to="/clients" className={navClass}>
            Клиенты
          </NavLink>
          <NavLink to="/deals" className={navClass}>
            Сделки
          </NavLink>
          <NavLink to="/tasks" className={navClass}>
            Задачи
          </NavLink>
          <NavLink to="/calls/create" className={callsNavClass}>
            Звонки
          </NavLink>
          <NavLink to="/calls/assign-recording" className={callsNavClass}>
            {isAdmin ? "Управление звонками" : "Видеозвонки"}
          </NavLink>
          <NavLink to="/documents/upload" className={navClass}>
            Загрузка документов
          </NavLink>
          <NavLink to="/documents" className={navClass}>
            Документы
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            Личный кабинет
          </NavLink>
          {isAdmin ? (
            <NavLink to="/users" className={navClass}>
              Пользователи
            </NavLink>
          ) : null}
        </nav>

        <div className="spa-sidebar-footer">
          <p className="spa-nav-user">{user?.fullName ?? ""}</p>
          <p className="spa-nav-role">{isAdmin ? "Администратор" : "Менеджер"}</p>
          <button type="button" className="spa-nav-logout" onClick={logout}>
            Выход
          </button>
        </div>
      </aside>

      <div className="spa-main">
        <header className="spa-topbar">
          <div>
            <p className="spa-topbar-kicker">{isAdmin ? "Режим администратора" : "Режим менеджера"}</p>
            <h1>{currentTitle}</h1>
          </div>
          <div className="spa-topbar-meta">
            <span className="spa-topbar-chip">{new Date().toLocaleDateString("ru-RU")}</span>
            <span className="spa-topbar-chip">{user?.fullName || "Пользователь"}</span>
          </div>
        </header>
        <div className="spa-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
