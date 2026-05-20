import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardOverview } from "../api";
import { useAuth } from "../authContext";
import { API_ORIGIN } from "../config";
import { buildDashboardResourceHref } from "../lib/dashboardDeepLink";
import { buildDealsRiskHref, buildTasksBucketHref } from "../lib/listViewQuery";

const recordingHref = (recordingUrl) =>
  recordingUrl ? encodeURI(`${API_ORIGIN}${recordingUrl}`) : null;

const formatDate = (value) => {
  if (!value) return "Не указано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return "Не указано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatMoney = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "—";
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return String(amount);
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(
    numeric,
  );
};

const prettifyLabel = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/^\w/, (ch) => ch.toUpperCase());

const TASK_BUCKET_KEYS = ["overdue", "today", "week"];

function Dashboard() {
  const { isAdmin } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  /** Фильтр списка задач менеджера: одна из корзин с сервера */
  const [managerTaskBucketFilter, setManagerTaskBucketFilter] = useState("overdue");

  const loadDashboard = async () => {
    setLoading(true);
    setErrorText("");
    try {
      const payload = await fetchDashboardOverview();
      setOverview(payload);
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const dashboardStats = useMemo(() => {
    if (!overview?.metrics) return [];

    if (overview.role === "admin") {
      return [
        { label: "Пользователи", value: overview.metrics.users, tone: "violet", linkTo: "/users" },
        {
          label: "Просроченные задачи",
          value: overview.metrics.overdueTasks,
          tone: "orange",
          linkTo: buildTasksBucketHref("overdue"),
        },
        { label: "Рисковые сделки", value: overview.metrics.riskyDeals, tone: "blue", linkTo: buildDealsRiskHref() },
        { label: "Документы", value: overview.metrics.documents, tone: "green", linkTo: "/documents" },
      ];
    }

    return [
      { label: "Мои клиенты", value: overview.metrics.clients, tone: "violet", linkTo: "/clients" },
      {
        label: "Просроченные задачи",
        value: overview.metrics.tasksOverdue,
        tone: "orange",
        linkTo: buildTasksBucketHref("overdue"),
      },
      { label: "Активные сделки", value: overview.metrics.dealsActive, tone: "blue", linkTo: "/deals" },
      { label: "Документы за период", value: overview.metrics.docsRecent, tone: "green", linkTo: "/documents" },
    ];
  }, [overview]);

  const managerTaskBuckets = overview?.taskBuckets || { overdue: [], today: [], week: [] };
  const alerts = overview?.alerts || [];
  const riskyDeals = overview?.riskyDeals || [];
  const recentCalls = overview?.recentCalls || [];
  const recentDocuments = overview?.recentDocuments || [];
  const managerHealth = overview?.managerHealth || [];
  const serverLogs = overview?.serverLogs || [];
  const quickActions = isAdmin
    ? [
        { to: buildTasksBucketHref("overdue"), label: "Проверить задачи", desc: "Просрочки, блокеры и контроль SLA" },
        { to: buildDealsRiskHref(), label: "Открыть сделки", desc: "Риски, этапы и план закрытий" },
        { to: "/users", label: "Команда", desc: "Пользователи и роли" },
        { to: "/documents", label: "Документы", desc: "Связанные файлы по клиентам" },
      ]
    : [
        { to: buildTasksBucketHref("overdue"), label: "Мои задачи", desc: "Фокус на сегодня и просроченные" },
        { to: buildDealsRiskHref(), label: "Мои сделки", desc: "Текущие этапы и суммы" },
        { to: "/clients", label: "Клиенты", desc: "Контакты и история работы" },
        { to: "/documents/upload", label: "Файлы", desc: "Загрузка и управление документами" },
      ];

  return (
    <div className="dashboard-page dashboard-modern">
      <header className="dashboard-hero">
        <div>
          <p className="dashboard-kicker">CRM Workspace</p>
          <h1>{isAdmin ? "Контроль системы" : "Рабочая панель менеджера"}</h1>
          <p className="dashboard-subtitle">
            {isAdmin
              ? "Командные риски, просрочки и состояние процессов в одном месте."
              : "Что важно сегодня: задачи и сделки в риске."}
          </p>
        </div>
        <button type="button" onClick={loadDashboard} className="refresh-btn modern-btn">
          Обновить данные
        </button>
      </header>

      {loading ? <p className="hint">Загрузка данных...</p> : null}
      {errorText ? <p className="hint error">{errorText}</p> : null}

      <section className="dashboard-actions-grid">
        {quickActions.map((action) => (
          <Link key={action.to} to={action.to} className="dashboard-action-card">
            <strong>{action.label}</strong>
            <p>{action.desc}</p>
          </Link>
        ))}
      </section>

      <main className="layout dashboard-layout">
        <section className="dashboard-metrics-wrap panel-wide">
          <div className="dashboard-block-head">
            <span className="dashboard-block-label">Метрики</span>
          </div>
          <div className="stats-grid">
            {dashboardStats.map((stat) => (
              <Link key={stat.label} to={stat.linkTo} className={`stat-card tone-${stat.tone}`}>
                <p>{stat.label}</p>
                <strong>{stat.value}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className={`panel ${overview?.role === "admin" ? "panel-wide dashboard-admin-notifications" : ""}`}>
          <h2>Уведомления</h2>
          <div className="panel-box modern-box">
            {alerts.length === 0 ? <div className="cell cell-muted">Уведомлений пока нет.</div> : null}
            {alerts.map((item, idx) => (
              <article key={`${item.category}-${idx}`} className="cell card-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{prettifyLabel(item.severity)}</p>
                </div>
                {item.actionUrl ? (
                  <Link to={item.actionUrl} className="status-badge dashboard-alert-action">
                    {item.actionLabel || "Открыть"}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {overview?.role === "manager" ? (
          <>
            <section className="panel">
              <h2>Задачи</h2>
              <div className="panel-box modern-box">
                <div className="dashboard-filter-chips tag-row modern-tags" role="tablist" aria-label="Тип задач">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={managerTaskBucketFilter === "overdue"}
                    className={`dashboard-chip ${managerTaskBucketFilter === "overdue" ? "active" : ""}`}
                    onClick={() => setManagerTaskBucketFilter("overdue")}
                  >
                    Просроченные: {managerTaskBuckets.overdue.length}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={managerTaskBucketFilter === "today"}
                    className={`dashboard-chip ${managerTaskBucketFilter === "today" ? "active" : ""}`}
                    onClick={() => setManagerTaskBucketFilter("today")}
                  >
                    Сегодня: {managerTaskBuckets.today.length}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={managerTaskBucketFilter === "week"}
                    className={`dashboard-chip ${managerTaskBucketFilter === "week" ? "active" : ""}`}
                    onClick={() => setManagerTaskBucketFilter("week")}
                  >
                    Неделя: {managerTaskBuckets.week.length}
                  </button>
                </div>
                {(managerTaskBuckets[managerTaskBucketFilter] || []).length > 0 ? (
                  <p className="hint" style={{ marginBottom: "0.75rem" }}>
                    <Link to={buildTasksBucketHref(managerTaskBucketFilter)}>Открыть все задачи этой категории в таблице</Link>
                  </p>
                ) : null}
                {TASK_BUCKET_KEYS.every((k) => (managerTaskBuckets[k]?.length || 0) === 0) ? (
                  <div className="cell cell-muted">Нет задач в приоритетной очереди.</div>
                ) : (
                  <>
                    {(managerTaskBuckets[managerTaskBucketFilter] || []).slice(0, 24).map((task) => (
                      <article key={task.id} className="cell card-row dashboard-task-row">
                        <div>
                          <strong>
                            <Link to={buildDashboardResourceHref("/tasks", { recordId: task.id, filterField: "id" })}>
                              {task.title}
                            </Link>
                          </strong>
                          <p>{task.description || "Без описания"}</p>
                          <p className="dashboard-task-meta">
                            Срок: {task.dueDate ? formatDate(task.dueDate) : "не задан"} · Приоритет:{" "}
                            {prettifyLabel(task.priority || "medium")}
                          </p>
                        </div>
                        <span className="status-badge">{prettifyLabel(task.status || "new")}</span>
                      </article>
                    ))}
                    {(managerTaskBuckets[managerTaskBucketFilter] || []).length === 0 ? (
                      <div className="cell cell-muted">В этой категории задач нет.</div>
                    ) : null}
                  </>
                )}
              </div>
            </section>

            <section className="panel panel-wide">
              <h2>Сделки в риске</h2>
              {riskyDeals.length > 0 ? (
                <p className="hint" style={{ marginTop: "-0.25rem", marginBottom: "0.75rem" }}>
                  <Link to={buildDealsRiskHref()}>Открыть все рисковые сделки в таблице</Link>
                </p>
              ) : null}
              <div className="panel-box modern-box">
                {riskyDeals.length === 0 ? <div className="cell cell-muted">Рисковых сделок не найдено.</div> : null}
                {riskyDeals.map((deal) => (
                  <div key={deal.id} className="record modern-record">
                    <div className="record-header">
                      <h3>
                        <Link to={buildDashboardResourceHref("/deals", { recordId: deal.id, filterField: "id" })}>
                          {deal.title}
                        </Link>
                      </h3>
                      <span className="status-badge">{prettifyLabel(deal.stage || "new")}</span>
                    </div>
                    <div className="cell-grid">
                      <div className="cell">Клиент: {deal.client?.name || `ID ${deal.clientId}`}</div>
                      <div className="cell">Сумма: {formatMoney(deal.amount)}</div>
                      <div className="cell">Закрытие: {formatDate(deal.closingDate)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel panel-wide">
              <h2>История звонков по моим клиентам</h2>
              {recentCalls.length > 0 ? (
                <p className="hint" style={{ marginTop: "-0.25rem", marginBottom: "0.75rem" }}>
                  <Link to="/calls/create">Открыть все звонки</Link>
                </p>
              ) : null}
              <div className="panel-box modern-box">
                {recentCalls.length === 0 ? <div className="cell cell-muted">Звонков по вашим клиентам пока нет.</div> : null}
                {recentCalls.map((call) => {
                  const audioSrc = recordingHref(call.recordingUrl);
                  return (
                    <article key={call.id} className="cell card-row dashboard-call-row">
                      <div>
                        <strong>
                          <Link to={buildDashboardResourceHref("/calls", { recordId: call.id, filterField: "id" })}>
                            {call.client?.name || `Клиент #${call.clientId}`}
                          </Link>
                        </strong>
                        <p>
                          {formatDateTime(call.startedAt)} · {prettifyLabel(call.direction || "out")} ·{" "}
                          {prettifyLabel(call.status || "completed")}
                        </p>
                        <p className="dashboard-task-meta">
                          Оператор: {call.caller?.fullName || `ID ${call.callerId}`}
                          {call.duration != null ? ` · ${call.duration} с` : ""}
                        </p>
                        {audioSrc ? (
                          <audio controls className="call-audio-table dashboard-call-audio" src={audioSrc}>
                            <a href={audioSrc} target="_blank" rel="noreferrer">
                              Открыть запись
                            </a>
                          </audio>
                        ) : (
                          <p className="hint">Запись не прикреплена</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel panel-wide">
              <h2>Документы по моим клиентам</h2>
              {recentDocuments.length > 0 ? (
                <p className="hint" style={{ marginTop: "-0.25rem", marginBottom: "0.75rem" }}>
                  <Link to="/documents">Открыть все документы</Link>
                </p>
              ) : null}
              <div className="panel-box modern-box">
                {recentDocuments.length === 0 ? (
                  <div className="cell cell-muted">Документов по вашим клиентам пока нет.</div>
                ) : null}
                {recentDocuments.map((doc) => {
                  const fileHref = doc.filePath ? encodeURI(`${API_ORIGIN}${doc.filePath}`) : null;
                  return (
                    <article key={doc.id} className="cell card-row">
                      <div>
                        <strong>
                          <Link to={buildDashboardResourceHref("/documents", { recordId: doc.id, filterField: "id" })}>
                            {doc.filename}
                          </Link>
                        </strong>
                        <p>
                          Клиент: {doc.client?.name || `ID ${doc.clientId}`} · Загрузил:{" "}
                          {doc.uploader?.fullName || `ID ${doc.uploaderId}`}
                        </p>
                        <p className="dashboard-task-meta">Загружен: {formatDateTime(doc.uploadedAt)}</p>
                        {fileHref ? (
                          <a href={fileHref} target="_blank" rel="noreferrer" className="status-badge dashboard-alert-action">
                            Открыть файл
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="panel panel-wide">
            <h2>Командное здоровье</h2>
            <div className="panel-box modern-box">
              {managerHealth.length === 0 ? <div className="cell cell-muted">Нет данных по менеджерам.</div> : null}
              <div className="cell-grid">
                {managerHealth.map((m) => (
                  <div key={m.managerId} className="cell">
                    <strong>
                      <Link to={buildDashboardResourceHref("/tasks", { recordId: m.managerId, filterField: "authorId" })}>
                        {m.managerName}
                      </Link>
                    </strong>
                    <p>Просрочки: {m.overdueTasks}</p>
                    <p>
                      Риски сделок: {m.riskyDeals}{" "}
                      <Link to={buildDealsRiskHref()}>(таблица)</Link>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {overview?.role === "admin" ? (
          <section className="panel panel-wide">
            <h2>Последняя активность</h2>
            <div className="panel-box modern-box">
              {serverLogs.length === 0 ? <div className="cell cell-muted">Нет событий в системном журнале.</div> : null}
              {serverLogs.map((log) => (
                <article key={log.id} className="cell card-row dashboard-log-row">
                  <div className="dashboard-log-main">
                    <strong>{log.message}</strong>
                    <p>
                      Источник: {prettifyLabel(log.source || "system")} · Время: {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <div className="dashboard-log-level">
                    <span className="status-badge dashboard-log-severity">{prettifyLabel(log.level || "info")}</span>
                  </div>
                  <div className="dashboard-log-link">
                    {log.actionUrl ? (
                      <Link to={log.actionUrl} className="status-badge dashboard-alert-action">
                        {log.actionLabel || "Открыть"}
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default Dashboard;
