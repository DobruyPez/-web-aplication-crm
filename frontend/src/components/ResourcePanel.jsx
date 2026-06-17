import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createClientInviteLink,
  createItem,
  deleteItem,
  fetchList,
  fetchUploadedDocFiles,
  fetchUploadedVoiceFiles,
  updateItem,
} from "../api";
import { useAuth } from "../authContext";
import { API_ORIGIN, DEAL_STAGES, TASK_PRIORITIES, TASK_STATUSES } from "../config";
import {
  getCallDirectionLabel,
  getCallStatusLabel,
  getDealStageLabel,
  getEnumOptionLabel,
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getUserRoleLabel,
} from "../lib/enumLabels";
import { formatRef, sortLoadedRecords } from "../lib/loadedTableSort";
import { DASHBOARD_DEEP_FILTER_FIELDS } from "../lib/dashboardDeepLink";
import { groupCallsByDay } from "../lib/callHistoryGroups";
import { buildCallsClientHistoryHref, parseListViewSearchParams } from "../lib/listViewQuery";
import { buildClientInviteUrl } from "../lib/appUrl";
import { resolveClientInviteAbsoluteUrl } from "../lib/clientInviteLink";
import { deriveDealsPanelStateFromSearch } from "../lib/syncDealsFromUrl.js";
import { dealMatchesDashboardRisk, taskMatchesDashboardBucket } from "../lib/managerTaskBuckets";
import { formatDealAmount } from "../lib/formatDealAmount.js";
import ClientContactPointsEditor from "./ClientContactPointsEditor.jsx";
import ClientContactPointsCard from "./ClientContactPointsCard.jsx";
import {
  buildContactPersonsPayload,
  getContactPointsSearchText,
  normalizeContactPersonsForForm,
  resolveContactPersonsForDisplay,
  validateContactPersons,
} from "../lib/clientContactPoints.js";
import { formatClientOptionLabel, formatClientRef, getClientCardTitle } from "../lib/clientDisplay.js";
import { getDealCardTitle } from "../lib/dealDisplay.js";

const managerSelectOptions = (users) =>
  (Array.isArray(users) ? users : [])
    .filter((u) => {
      const role = String(u?.role || "").trim().toLowerCase();
      return role === "manager" || role === "admin";
    })
    .map((u) => ({
      value: String(u.id),
      label: u.fullName ? `${u.fullName} (ID ${u.id})` : `ID ${u.id}`,
    }));
import {
  paginateResourceList,
  RESOURCE_LIST_PAGE_SIZE,
} from "../lib/resourceListPagination.js";

/** Список всегда сортируется по id; в UI меняется только направление. */
const LIST_SORT_FIELD = "id";

function ResourceListPagination({ page, pageCount, rangeStart, rangeEnd, total, onPageChange }) {
  if (total <= RESOURCE_LIST_PAGE_SIZE) {
    return null;
  }

  return (
    <nav className="resource-pagination" aria-label="Страницы списка">
      <p className="resource-pagination-summary">
        Показано {rangeStart}–{rangeEnd} из {total}
      </p>
      <div className="resource-pagination-controls">
        <button type="button" className="secondary-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Назад
        </button>
        <span className="resource-pagination-page">
          Страница {page} из {pageCount}
        </span>
        <button
          type="button"
          className="secondary-btn"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </button>
      </div>
    </nav>
  );
}

/** Начальное состояние блока «Фильтрация» при F5: до useLayoutEffect первый кадр уже совпадает с query. */
function initialDealsPanelFiltersFromSearch(search, resourceFields) {
  const d = deriveDealsPanelStateFromSearch(search, resourceFields);
  return {
    filterField: d.filterField,
    filterValue: d.filterValue,
    quickFilter: d.quickFilter,
    sortDirection: d.sortDirection === "asc" ? "asc" : "desc",
  };
}

let dealsMountSeedCacheKey = "";
let dealsMountSeedCacheVal = null;

function dealsPanelMountSeed(resource, location) {
  if (resource.key !== "deals") {
    dealsMountSeedCacheKey = "";
    dealsMountSeedCacheVal = null;
    return null;
  }
  const fieldsKey = Array.isArray(resource.fields)
    ? resource.fields.map((f) => f.name).slice().sort().join("|")
    : "";
  const key = `${location.search}\u0000${fieldsKey}`;
  if (key === dealsMountSeedCacheKey && dealsMountSeedCacheVal) {
    return dealsMountSeedCacheVal;
  }
  dealsMountSeedCacheKey = key;
  dealsMountSeedCacheVal = initialDealsPanelFiltersFromSearch(location.search, resource.fields);
  return dealsMountSeedCacheVal;
}

const toInputValue = (value) => (value === null || value === undefined ? "" : String(value));

const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toDateValue = (value) => {
  if (!value) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const integerTypes = new Set(["int"]);
const numericTypes = new Set(["decimal"]);

const normalizeByType = (rawValue, fieldMeta) => {
  const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  const type = fieldMeta?.type || "string";
  const required = Boolean(fieldMeta?.required);

  if (value === "") {
    return required ? "" : null;
  }

  if (integerTypes.has(type)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : value;
  }

  if (numericTypes.has(type)) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
};

const normalizeEnum = (value) => String(value).trim().toLowerCase().replace(/\s+/g, "_");
const managerDbTabs = new Set(["clients", "deals", "tasks"]);
const CALL_DIRECTIONS = ["out", "in"];
const CALL_STATUSES = ["completed", "missed", "failed"];
const RESOURCE_PRIMARY_FIELD = {
  clients: "name",
  deals: "productName",
  tasks: "title",
  calls: "id",
  documents: "filename",
  users: "fullName",
};
const FIELD_LABELS = {
  id: "ID",
  fullName: "ФИО",
  email: "Электронная почта",
  password: "Пароль",
  role: "Роль",
  phone: "Телефон",
  telegramLink: "Ссылка Telegram",
  telegramChatId: "ID чата Telegram",
  name: "Название компании",
  productName: "Предмет сделки",
  address: "Адрес",
  notes: "Заметки",
  managerId: "Менеджер",
  title: "Название сделки",
  description: "Описание",
  amount: "Сумма",
  stage: "Этап",
  closingDate: "Дата закрытия",
  clientId: "Клиент",
  documentIds: "Документы",
  callerId: "Оператор",
  direction: "Направление",
  status: "Статус",
  duration: "Длительность (сек)",
  recordingUrl: "Голосовая запись",
  startedAt: "Начало",
  endedAt: "Завершение",
  priority: "Приоритет",
  dueDate: "Срок",
  authorId: "Автор",
  dealId: "Сделка",
  filename: "Файл",
  filePath: "Путь",
  fileSize: "Размер",
  mimeType: "Тип файла",
  uploadedAt: "Загружен",
  uploaderId: "Загрузил",
  createdAt: "Создан",
  updatedAt: "Обновлен",
};
const getFieldLabel = (field) => FIELD_LABELS[field] || prettify(field);

const formatDateLike = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
};

const formatDateTimeLike = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const prettify = (value) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/^\w/, (ch) => ch.toUpperCase());

const getCardRows = (resourceKey, item, lookups = {}) => {
  const clientsMap = lookups.clientsById || {};
  const usersMap = lookups.usersById || {};
  const dealsMap = lookups.dealsById || {};

  if (resourceKey === "clients") {
    return [
      ["Адрес", item.address || "—"],
      ["Менеджер", formatRef(item.managerId, usersMap, "fullName")],
      ["Заметки", item.notes || "—"],
    ];
  }

  if (resourceKey === "deals") {
    const docs = Array.isArray(item.documents) ? item.documents : [];
    const documentsCell = docs.length ? (
      <ul className="deal-documents-list">
        {docs.map((doc) => {
          const href = doc.filePath ? encodeURI(`${API_ORIGIN}${doc.filePath}`) : null;
          const label = doc.filename || `Документ #${doc.id}`;
          return (
            <li key={doc.id}>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer">
                  {label}
                </a>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ul>
    ) : (
      "—"
    );
    return [
      ["Предмет сделки", item.productName || "—"],
      ["Название сделки", item.title || "—"],
      ["Этап", getDealStageLabel(item.stage || "new")],
      ["Сумма", formatDealAmount(item.amount)],
      ["Дата закрытия", formatDateLike(item.closingDate)],
      ["Клиент", formatClientRef(item.clientId, clientsMap)],
      ["Документы", documentsCell],
      ["Менеджер", formatRef(item.managerId, usersMap, "fullName")],
      ["Описание", item.description || "—"],
    ];
  }

  if (resourceKey === "tasks") {
    return [
      ["Название", item.title || "—"],
      ["Статус", getTaskStatusLabel(item.status || "new")],
      ["Приоритет", getTaskPriorityLabel(item.priority || "medium")],
      ["Срок", formatDateTimeLike(item.dueDate)],
      ["Автор", formatRef(item.authorId, usersMap, "fullName")],
      ["Клиент", formatClientRef(item.clientId, clientsMap)],
      ["Сделка", formatRef(item.dealId, dealsMap, "title")],
      ["Описание", item.description || "—"],
    ];
  }

  if (resourceKey === "documents") {
    const href = item.filePath ? encodeURI(`${API_ORIGIN}${item.filePath}`) : null;
    const clientLabel =
      (item.client && formatClientOptionLabel(item.client)) || formatClientRef(item.clientId, clientsMap);
    const uploaderLabel = item.uploader?.fullName || formatRef(item.uploaderId, usersMap, "fullName");
    return [
      ["Файл", item.filename || "—"],
      ["Путь", item.filePath || "—"],
      ["Клиент", clientLabel],
      ["Загрузил", uploaderLabel],
      ["Размер", item.fileSize ?? "—"],
      ["Тип", item.mimeType || "—"],
      ["Загружен", formatDateTimeLike(item.uploadedAt)],
      [
        "Открыть",
        href ? (
          <a href={href} target="_blank" rel="noreferrer">
            файл на сервере
          </a>
        ) : (
          "—"
        ),
      ],
    ];
  }

  if (resourceKey === "calls") {
    const href = item.recordingUrl ? encodeURI(`${API_ORIGIN}${item.recordingUrl}`) : null;
    const clientLabel =
      (item.client && formatClientOptionLabel(item.client)) || formatClientRef(item.clientId, clientsMap);
    const callerLabel = item.caller?.fullName || formatRef(item.callerId, usersMap, "fullName");
    return [
      ["Клиент", clientLabel],
      ["Оператор", callerLabel],
      ["Направление", item.direction ? getCallDirectionLabel(item.direction) : "—"],
      ["Статус", item.status ? getCallStatusLabel(item.status) : "—"],
      ["Длительность", item.duration ?? "—"],
      ["Начало", formatDateTimeLike(item.startedAt)],
      ["Завершение", formatDateTimeLike(item.endedAt)],
      [
        "Запись",
        href ? (
          String(item.recordingUrl || "").toLowerCase().endsWith(".webm") ? (
            <video controls className="call-audio-table" src={href}>
              <a href={href} target="_blank" rel="noreferrer">
                Открыть запись
              </a>
            </video>
          ) : (
            <audio controls className="call-audio-table" src={href}>
              <a href={href} target="_blank" rel="noreferrer">
                Открыть запись
              </a>
            </audio>
          )
        ) : (
          "—"
        ),
      ],
    ];
  }

  if (resourceKey === "users") {
    return [
      ["ФИО", item.fullName || "—"],
      ["Электронная почта", item.email || "—"],
      ["Роль", getUserRoleLabel(item.role || "manager")],
      ["Телефон", item.phone || "—"],
      [
        "Телеграм",
        item.telegramLink ? (
          <a href={item.telegramLink} target="_blank" rel="noreferrer">
            Профиль
          </a>
        ) : (
          "—"
        ),
      ],
      ["ID чата Telegram", item.telegramChatId || "—"],
      ["Создан", formatDateTimeLike(item.createdAt)],
    ];
  }

  return Object.entries(item).map(([k, v]) => [k, v === null || v === undefined || v === "" ? "—" : String(v)]);
};

const ResourcePanel = ({ resource, defaults = {} }) => {
  const { isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  locationRef.current = location;
  const [items, setItems] = useState([]);
  const [filterField, setFilterField] = useState(() => dealsPanelMountSeed(resource, location)?.filterField ?? "all");
  const [filterValue, setFilterValue] = useState(() => dealsPanelMountSeed(resource, location)?.filterValue ?? "");
  const [quickFilter, setQuickFilter] = useState(() => dealsPanelMountSeed(resource, location)?.quickFilter ?? "all");
  const [sortDirection, setSortDirection] = useState(
    () => dealsPanelMountSeed(resource, location)?.sortDirection ?? "desc",
  );
  const [formData, setFormData] = useState({});
  const [status, setStatus] = useState({ type: "idle", text: "" });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploadedDocsMeta, setUploadedDocsMeta] = useState([]);
  const [uploadedVoiceMeta, setUploadedVoiceMeta] = useState([]);
  const [inviteStatus, setInviteStatus] = useState({ type: "idle", text: "" });
  const [clientInviteLinks, setClientInviteLinks] = useState({});
  const [clientsList, setClientsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [dealsList, setDealsList] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [listPage, setListPage] = useState(1);

  const clientsById = useMemo(() => Object.fromEntries(clientsList.map((c) => [c.id, c])), [clientsList]);
  const usersById = useMemo(() => Object.fromEntries(usersList.map((u) => [u.id, u])), [usersList]);
  const dealsById = useMemo(() => Object.fromEntries(dealsList.map((d) => [d.id, d])), [dealsList]);
  const usersByIdWithCurrent = useMemo(
    () => ({
      ...usersById,
      ...(user?.id ? { [user.id]: user } : {}),
    }),
    [user, usersById],
  );
  const lookupOptionsByField = useMemo(() => {
    const options = {};

    const managers = managerSelectOptions(usersList);

    if (resource.key === "clients" || resource.key === "deals") {
      options.managerId = managers;
    }

    if (resource.key === "deals") {
      options.clientId = clientsList.map((client) => ({
        value: String(client.id),
        label: formatClientOptionLabel(client),
      }));
    }

    if (resource.key === "tasks") {
      options.clientId = clientsList.map((client) => ({
        value: String(client.id),
        label: formatClientOptionLabel(client),
      }));
      options.dealId = dealsList.map((deal) => ({
        value: String(deal.id),
        label: getDealCardTitle(deal),
      }));
    }

    if (resource.key === "calls") {
      options.clientId = clientsList.map((client) => ({
        value: String(client.id),
        label: formatClientOptionLabel(client),
      }));
      options.callerId = usersList.map((u) => ({
        value: String(u.id),
        label: u.fullName || `ID ${u.id}`,
      }));
    }

    return options;
  }, [clientsList, dealsList, resource.key, usersList]);

  const datetimeMinValue = useMemo(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, [loading]);
  const dateMinValue = useMemo(() => datetimeMinValue.slice(0, 10), [datetimeMinValue]);

  const fields = useMemo(() => {
    const hideClientKeys = new Set(["company"]);
    const stripHidden = (list) =>
      resource.key === "clients" ? list.filter((key) => !hideClientKeys.has(key)) : list;

    if (Array.isArray(resource.fields) && resource.fields.length > 0) {
      return stripHidden(resource.fields.map((field) => field.name));
    }
    if (items.length > 0 && resource.requiredFields.length > 0) {
      return stripHidden(
        Object.keys(items[0]).filter((key) => resource.requiredFields.includes(key)),
      );
    }
    return stripHidden(resource.requiredFields);
  }, [items, resource.fields, resource.requiredFields, resource.key]);
  const filterableFields = useMemo(() => ["all", "id", ...fields], [fields]);

  const fieldMetaMap = useMemo(() => {
    if (!Array.isArray(resource.fields)) {
      return {};
    }
    return Object.fromEntries(resource.fields.map((field) => [field.name, field]));
  }, [resource.fields]);

  const fieldNamesKey = useMemo(
    () => (Array.isArray(resource.fields) ? resource.fields.map((f) => f.name).slice().sort().join("|") : ""),
    [resource.fields],
  );

  const lastUrlSigRef = useRef("");
  const applyDealsListFromUrlRef = useRef(() => {});

  const reload = async () => {
    setLoading(true);
    setStatus({ type: "idle", text: "" });
    try {
      const data = await fetchList(resource.key);
      setItems(data);

      const needClients = ["clients", "deals", "tasks", "documents", "calls"].includes(resource.key);
      /* GET /api/users только для администратора; иначе 403 при каждом reload (менеджер на сделках и т.д.). */
      const needUsers =
        isAdmin && ["clients", "deals", "tasks", "documents", "calls"].includes(resource.key);
      const needDeals = ["tasks"].includes(resource.key);
      const needDocumentsList = resource.key === "deals";
      const needUploadMeta = resource.key === "documents";
      const needVoiceMeta = resource.key === "calls" && isAdmin;

      const [meta, voiceMeta, clientRows, userRows, dealRows, documentRows] = await Promise.all([
        needUploadMeta ? fetchUploadedDocFiles() : Promise.resolve([]),
        needVoiceMeta ? fetchUploadedVoiceFiles() : Promise.resolve([]),
        needClients ? fetchList("clients") : Promise.resolve([]),
        needUsers ? fetchList("users").catch(() => []) : Promise.resolve([]),
        needDeals ? fetchList("deals") : Promise.resolve([]),
        needDocumentsList ? fetchList("documents") : Promise.resolve([]),
      ]);

      setUploadedDocsMeta(meta);
      setUploadedVoiceMeta(voiceMeta);
      setClientsList(clientRows);
      setUsersList(userRows);
      setDealsList(dealRows);
      setDocumentsList(documentRows);
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    } finally {
      setLoading(false);
      /* После загрузки списка снова подставляем query (актуальный URL через ref — не stale closure). */
      applyDealsListFromUrlRef.current();
    }
  };

  const applyDealsListFromUrl = () => {
    if (resource.key !== "deals") {
      return;
    }
    const search = locationRef.current.search;
    const d = deriveDealsPanelStateFromSearch(search, resource.fields);
    setFilterField(d.filterField);
    setFilterValue(d.filterValue);
    setQuickFilter(d.quickFilter);
    const sig = `${resource.key}|${search}`;
    const urlBundleChanged = lastUrlSigRef.current !== sig;
    lastUrlSigRef.current = sig;
    setSortDirection(d.sortDirection === "asc" ? "asc" : "desc");
  };
  applyDealsListFromUrlRef.current = applyDealsListFromUrl;

  /** Сделки: query → фильтры до отрисовки. */
  useLayoutEffect(() => {
    if (resource.key !== "deals") {
      return;
    }
    applyDealsListFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- синхронизация только из URL
  }, [resource.key, location.search, resource.fields]);

  useEffect(() => {
    setEditingId(null);
    const initial = { ...defaults };
    if (resource.key === "clients") {
      initial.contactPersons = normalizeContactPersonsForForm([]);
    }
    setFormData(initial);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- смена ресурса / defaults
  }, [resource.key, defaults]);

  useEffect(() => {
    if (resource.key === "deals") {
      return;
    }
    const params = parseListViewSearchParams(location.search, resource.key);
    const names = Array.isArray(resource.fields) ? resource.fields.map((f) => f.name) : [];
    const deepExtra = DASHBOARD_DEEP_FILTER_FIELDS[resource.key];
    const allowed = new Set(["all", "id", ...names, ...(deepExtra ? [...deepExtra] : [])]);
    let ff = params.filterField;
    let fv = params.filterValue;
    if (!allowed.has(ff)) {
      ff = "all";
      fv = "";
    }
    setFilterField(ff);
    setFilterValue(fv);
    setQuickFilter(params.quickFilter);

    const sig = `${resource.key}|${location.search}`;
    const urlBundleChanged = lastUrlSigRef.current !== sig;
    lastUrlSigRef.current = sig;

    if (params.sortDirection === "asc" || params.sortDirection === "desc") {
      setSortDirection(params.sortDirection);
    } else if (urlBundleChanged) {
      setSortDirection("desc");
    }
  }, [resource.key, location.search, fieldNamesKey]);

  const onChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (resource.key === "deals" && field === "clientId") {
        next.documentIds = [];
      }
      return next;
    });
  };

  const clientDocumentsForDeal = useMemo(() => {
    if (resource.key !== "deals" || !formData.clientId) {
      return [];
    }
    const clientId = String(formData.clientId);
    return documentsList.filter((doc) => String(doc.clientId) === clientId);
  }, [documentsList, formData.clientId, resource.key]);

  const applyCallRecordingMeta = async (recordingPath, startedAtOverride) => {
    if (!recordingPath) {
      setFormData((prev) => ({ ...prev, recordingUrl: "", duration: "", endedAt: "" }));
      return;
    }
    const startedRaw = startedAtOverride ?? formData.startedAt ?? defaults.startedAt;
    const startedAt = startedRaw ? new Date(startedRaw) : null;
    const startedAtOk = startedAt && !Number.isNaN(startedAt.getTime());
    const audioUrl = encodeURI(`${API_ORIGIN}${recordingPath}`);

    const durationSeconds = await new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = audioUrl;
      audio.onloadedmetadata = () => {
        const sec = Number.isFinite(audio.duration) ? Math.max(0, Math.round(audio.duration)) : 0;
        resolve(sec);
      };
      audio.onerror = () => resolve(0);
    });

    let endedAt = "";
    if (startedAtOk) {
      const end = new Date(startedAt.getTime() + durationSeconds * 1000);
      endedAt = toDatetimeLocalValue(end.toISOString());
    }

    setFormData((prev) => ({
      ...prev,
      recordingUrl: recordingPath,
      duration: String(durationSeconds),
      endedAt,
    }));
  };

  const validate = () => {
    for (const required of resource.requiredFields) {
      if (formData[required] === undefined || formData[required] === null || formData[required] === "") {
        return `Поле «${getFieldLabel(required)}» обязательно`;
      }
    }

    // Для менеджера на рабочих вкладках: дата/время не может быть раньше текущего момента.
    if (!isAdmin && managerDbTabs.has(resource.key)) {
      for (const field of fields) {
        const meta = fieldMetaMap[field];
        if ((meta?.type === "date" || meta?.type === "datetime") && formData[field]) {
          const parsed = new Date(formData[field]);
          if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) {
            return `Поле «${getFieldLabel(field)}» не может быть раньше текущей даты и времени`;
          }
        }
      }
    }

    if (resource.key === "clients") {
      const contactErr = validateContactPersons(formData.contactPersons);
      if (contactErr) {
        return contactErr;
      }
    }

    if (resource.key === "deals") {
      if (formData.title && String(formData.title).trim().length < 3) {
        return `Поле "${getFieldLabel("title")}" должно содержать минимум 3 символа`;
      }
      if (formData.amount !== undefined && formData.amount !== null && formData.amount !== "") {
        const amount = Number(formData.amount);
        if (Number.isNaN(amount) || amount < 0) {
          return `Поле "${getFieldLabel("amount")}" должно быть числом ≥ 0`;
        }
      }
      if (formData.stage && !DEAL_STAGES.includes(normalizeEnum(formData.stage))) {
        return `Поле "${getFieldLabel("stage")}" должно быть одним из допустимых этапов`;
      }
    }

    if (resource.key === "tasks") {
      if (formData.title && String(formData.title).trim().length < 3) {
        return `Поле "${getFieldLabel("title")}" должно содержать минимум 3 символа`;
      }
      if (formData.status && !TASK_STATUSES.includes(normalizeEnum(formData.status))) {
        return `Поле "${getFieldLabel("status")}" должно быть одним из допустимых статусов`;
      }
      if (formData.priority && !TASK_PRIORITIES.includes(normalizeEnum(formData.priority))) {
        return `Поле "${getFieldLabel("priority")}" должно быть одним из допустимых приоритетов`;
      }
    }

    if (resource.key === "documents") {
      const fn = formData.filename ? String(formData.filename).trim() : "";
      if (fn && !uploadedDocsMeta.some((f) => f.filename === fn)) {
        return "Выберите файл из списка загруженных на сервере (вкладка «Загрузка документов»).";
      }
    }

    if (resource.key === "calls") {
      const requiredCallFields = ["clientId", "callerId", "direction", "status", "startedAt"];
      for (const requiredField of requiredCallFields) {
        if (formData[requiredField] === undefined || formData[requiredField] === null || formData[requiredField] === "") {
          return `Поле «${getFieldLabel(requiredField)}» обязательно`;
        }
      }
      const rp = formData.recordingUrl ? String(formData.recordingUrl).trim() : "";
      if (!rp) {
        return 'Для звонка обязательно выберите "Голосовую запись" (без записи создавать нельзя).';
      }
      if (rp && !uploadedVoiceMeta.some((f) => f.filePath === rp)) {
        return "Выберите голосовую запись из списка загруженных на сервере.";
      }
      if (formData.direction && !CALL_DIRECTIONS.includes(normalizeEnum(formData.direction))) {
        return `Поле "${getFieldLabel("direction")}" должно быть одним из допустимых направлений`;
      }
      if (formData.status && !CALL_STATUSES.includes(normalizeEnum(formData.status))) {
        return `Поле "status" должно быть одним из: ${CALL_STATUSES.join(", ")}`;
      }
      if (formData.duration !== undefined && formData.duration !== null && formData.duration !== "") {
        const duration = Number(formData.duration);
        if (Number.isNaN(duration) || duration < 0) {
          return `Поле "${getFieldLabel("duration")}" должно быть числом ≥ 0`;
        }
      }
      if (formData.startedAt) {
        const startedAt = new Date(formData.startedAt);
        if (Number.isNaN(startedAt.getTime())) {
          return `Поле "${getFieldLabel("startedAt")}" содержит некорректную дату/время`;
        }
        if (startedAt.getTime() < Date.now()) {
          return `Поле "${getFieldLabel("startedAt")}" не может быть раньше текущих даты и времени`;
        }
      }
      if (formData.endedAt) {
        const endedAt = new Date(formData.endedAt);
        if (Number.isNaN(endedAt.getTime())) {
          return `Поле "${getFieldLabel("endedAt")}" содержит некорректную дату/время`;
        }
        if (endedAt.getTime() < Date.now()) {
          return `Поле "${getFieldLabel("endedAt")}" не может быть раньше текущих даты и времени`;
        }
        if (formData.startedAt) {
          const startedAt = new Date(formData.startedAt);
          if (!Number.isNaN(startedAt.getTime()) && endedAt.getTime() < startedAt.getTime()) {
            return `Поле "${getFieldLabel("endedAt")}" не может быть раньше «${getFieldLabel("startedAt")}»`;
          }
        }
      }
    }

    return null;
  };

  const buildPayloadFromForm = () => {
    const merged = { ...defaults, ...formData };
    const payload = Object.fromEntries(fields.map((field) => [field, normalizeByType(merged[field], fieldMetaMap[field])]));

    if (payload.stage !== undefined && payload.stage !== null && payload.stage !== "") {
      payload.stage = normalizeEnum(payload.stage);
    }
    if (payload.status !== undefined && payload.status !== null && payload.status !== "") {
      payload.status = normalizeEnum(payload.status);
    }
    if (payload.priority !== undefined && payload.priority !== null && payload.priority !== "") {
      payload.priority = normalizeEnum(payload.priority);
    }
    if (resource.key === "calls") {
      if (payload.direction !== undefined && payload.direction !== null && payload.direction !== "") {
        payload.direction = normalizeEnum(payload.direction);
      }
      if (payload.status !== undefined && payload.status !== null && payload.status !== "") {
        payload.status = normalizeEnum(payload.status);
      }
    }

    const result = { ...defaults, ...payload };
    if (resource.key === "deals") {
      const ids = Array.isArray(merged.documentIds) ? merged.documentIds : [];
      result.documentIds = ids
        .map((value) => Number.parseInt(String(value), 10))
        .filter((id) => Number.isFinite(id) && id > 0);
    }
    if (resource.key === "clients") {
      result.contactPersons = buildContactPersonsPayload(merged.contactPersons);
    }
    return result;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationMessage = validate();
    if (validationMessage) {
      setStatus({ type: "error", text: validationMessage });
      return;
    }

    let payload = buildPayloadFromForm();

    if (resource.key === "documents") {
      const meta = uploadedDocsMeta.find((f) => f.filename === payload.filename);
      if (!meta) {
        setStatus({ type: "error", text: "Выберите файл из списка загруженных на сервере." });
        return;
      }
      payload = {
        ...payload,
        filePath: meta.filePath,
        fileSize: meta.fileSize,
        mimeType: meta.mimeType,
      };
    }

    if (resource.key === "calls" && payload.recordingUrl) {
      const voiceMeta = uploadedVoiceMeta.find((f) => f.filePath === payload.recordingUrl);
      if (!voiceMeta) {
        setStatus({ type: "error", text: "Выберите голосовую запись из списка." });
        return;
      }
      payload = {
        ...payload,
        recordingUrl: voiceMeta.filePath,
      };
    }

    if (editingId) {
      const existing = items.find((item) => item.id === editingId);
      payload = { ...(existing || {}), ...payload };
      if (resource.key === "deals") {
        delete payload.documents;
      }
      if (resource.key === "clients") {
        delete payload.contactPersons;
        delete payload.contactPoints;
        payload.contactPersons = buildContactPersonsPayload(formData.contactPersons);
      }
    }

    setStatus({ type: "idle", text: "" });
    try {
      if (editingId) {
        await updateItem(resource.key, editingId, payload);
        setStatus({ type: "success", text: "Запись обновлена" });
      } else {
        await createItem(resource.key, payload);
        setStatus({ type: "success", text: "Запись создана" });
      }
      setEditingId(null);
      const initial = { ...defaults };
      if (resource.key === "clients") {
        initial.contactPersons = normalizeContactPersonsForForm([]);
      }
      setFormData(initial);
      await reload();
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    }
  };

  const startEdit = (item) => {
    const next = { ...defaults };
    for (const field of fields) {
      const meta = fieldMetaMap[field];
      let val = item[field];
      if (meta?.type === "datetime") {
        val = toDatetimeLocalValue(val);
      } else if (meta?.type === "date") {
        val = toDateValue(val);
      } else if (val !== undefined && val !== null) {
        val = String(val);
      } else {
        val = "";
      }
      next[field] = val;
    }
    if (resource.key === "users") {
      next.password = "";
    }
    if (resource.key === "deals") {
      next.documentIds = Array.isArray(item.documents) ? item.documents.map((doc) => String(doc.id)) : [];
    }
    if (resource.key === "clients") {
      next.contactPersons = normalizeContactPersonsForForm(resolveContactPersonsForDisplay(item));
    }
    setFormData(next);
    setEditingId(item.id);
    setStatus({ type: "idle", text: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    const initial = { ...defaults };
    if (resource.key === "clients") {
      initial.contactPersons = normalizeContactPersonsForForm([]);
    }
    setFormData(initial);
    setStatus({ type: "idle", text: "" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить запись?")) {
      return;
    }
    setStatus({ type: "idle", text: "" });
    try {
      await deleteItem(resource.key, id);
      setStatus({ type: "success", text: "Удалено" });
      if (editingId === id) {
        cancelEdit();
      }
      await reload();
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    }
  };

  const showRowActions = !(resource.key === "calls" && !isAdmin);
  const showStatusQuickFilters = resource.key === "users";
  const quickFilterOptions = useMemo(() => {
    if (!showStatusQuickFilters) {
      return [];
    }
    return [
      { value: "admin", label: "Администратор", field: "role" },
      { value: "manager", label: "Менеджер", field: "role" },
    ];
  }, [showStatusQuickFilters]);
  const activeQuickFilterMeta = useMemo(
    () => quickFilterOptions.find((option) => option.value === quickFilter) || null,
    [quickFilterOptions, quickFilter],
  );

  const listBucket = useMemo(() => {
    const p = new URLSearchParams(location.search).get("listBucket");
    return ["overdue", "today", "week"].includes(p) ? p : null;
  }, [location.search]);

  const listRisk = useMemo(() => (new URLSearchParams(location.search).get("listRisk") === "1" ? "1" : null), [
    location.search,
  ]);

  const filteredItems = useMemo(() => {
    const ff = filterField;
    const fvTrim = filterValue.trim();
    const fv = fvTrim.toLowerCase();

    return items.filter((item) => {
      let passFieldFilter = true;
      if (fv) {
        if (ff === "all") {
          const scalarMatch = Object.entries(item || {})
            .filter(([key]) => !(resource.key === "clients" && key === "company"))
            .map(([, v]) => String(v ?? "").toLowerCase())
            .some((v) => v.includes(fv));
          const contactsMatch =
            resource.key === "clients"
              ? getContactPointsSearchText(item).toLowerCase().includes(fv)
              : false;
          passFieldFilter = scalarMatch || contactsMatch;
        } else {
          const raw = item?.[ff];
          const idLike = ff === "id" || (typeof ff === "string" && ff.endsWith("Id"));
          const digitsOnly = /^\d+$/.test(fvTrim);
          if (idLike && digitsOnly) {
            const nCell = Number(raw);
            const nFv = Number(fvTrim);
            passFieldFilter = Number.isFinite(nCell) && Number.isFinite(nFv) && nCell === nFv;
          } else {
            passFieldFilter = String(raw ?? "")
              .toLowerCase()
              .includes(fv);
          }
        }
      }

      const passQuickFilter = activeQuickFilterMeta
        ? normalizeEnum(item?.[activeQuickFilterMeta.field] ?? "") === activeQuickFilterMeta.value
        : true;

      const passListBucket =
        resource.key !== "tasks" || !listBucket ? true : taskMatchesDashboardBucket(item, listBucket);

      const passListRisk =
        resource.key !== "deals" || listRisk !== "1" ? true : dealMatchesDashboardRisk(item);

      return passFieldFilter && passQuickFilter && passListBucket && passListRisk;
    });
  }, [
    filterField,
    filterValue,
    items,
    resource.key,
    clientsById,
    usersByIdWithCurrent,
    dealsById,
    activeQuickFilterMeta,
    listBucket,
    listRisk,
  ]);
  const sortedItems = useMemo(
    () =>
      sortLoadedRecords(filteredItems, {
        sortField: LIST_SORT_FIELD,
        sortDirection,
        fieldMetaMap,
        clientsById,
        dealsById,
        usersByIdWithCurrent,
      }),
    [filteredItems, sortDirection, fieldMetaMap, clientsById, dealsById, usersByIdWithCurrent],
  );

  useEffect(() => {
    setListPage(1);
  }, [filterField, filterValue, quickFilter, sortDirection, resource.key, listBucket, listRisk]);

  const listPagination = useMemo(
    () => paginateResourceList(sortedItems, listPage),
    [sortedItems, listPage],
  );
  const paginatedItems = listPagination.items;

  const callsClientFilterActive =
    resource.key === "calls" && filterField === "clientId" && String(filterValue || "").trim() !== "";
  const callsClientFilterName = callsClientFilterActive
    ? formatClientRef(filterValue, clientsById)
    : null;
  const callGroups = useMemo(
    () => (callsClientFilterActive ? groupCallsByDay(paginatedItems) : []),
    [callsClientFilterActive, paginatedItems],
  );

  const generateClientInviteLink = async (clientId) => {
    setInviteStatus({ type: "idle", text: "" });
    try {
      const { absoluteUrl, url, token } = await createClientInviteLink(clientId);
      const full = resolveClientInviteAbsoluteUrl(absoluteUrl || url || buildClientInviteUrl(token));
      setClientInviteLinks((prev) => ({ ...prev, [clientId]: full }));
      setInviteStatus({
        type: "success",
        text: `Ссылка для клиента #${clientId} создана. Отправьте её клиенту — он увидит ту же страницу приглашения.`,
      });
      return full;
    } catch (error) {
      setInviteStatus({ type: "error", text: error.message });
      return null;
    }
  };

  const renderResourceCard = (item) => {
    const isProtectedAdmin =
      resource.key === "users" && String(item.role || "").trim().toLowerCase() === "admin";
    return (
      <article
        key={item.id}
        className={`resource-card${resource.key === "clients" ? " resource-card--client" : ""}`}
      >
        <header className="resource-card-header">
          <div className="resource-card-title">
            <h3>
              {resource.key === "clients"
                ? getClientCardTitle(item)
                : resource.key === "deals"
                  ? getDealCardTitle(item)
                  : item?.[RESOURCE_PRIMARY_FIELD[resource.key]] || `Запись #${item.id}`}
            </h3>
            <p>ID: {item.id}</p>
          </div>
        </header>
        <div className="resource-card-grid">
          {getCardRows(resource.key, item, { clientsById, usersById: usersByIdWithCurrent, dealsById }).map(
            ([label, value]) => (
              <div key={`${item.id}-${label}`} className="resource-kv">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ),
          )}
        </div>
        {resource.key === "clients" ? <ClientContactPointsCard client={item} /> : null}
        {resource.key === "clients" && !isAdmin && clientInviteLinks[item.id] ? (
          <label className="field client-invite-field" style={{ margin: "0 0 12px" }}>
            <span>Ссылка приглашения (страница для клиента)</span>
            <input type="text" readOnly value={clientInviteLinks[item.id]} />
            <p className="hint" style={{ margin: 0 }}>
              Клиент откроет ссылку и пришлёт вам ту же ссылку обратно — вставьте её при входящем видеозвонке.
            </p>
          </label>
        ) : null}
        {showRowActions ? (
          <footer className="resource-card-actions">
            {isProtectedAdmin ? (
              <p className="hint" style={{ margin: 0 }}>
                Роль администратора — только БД; редактирование и удаление недоступны.
              </p>
            ) : (
              <>
                {resource.key === "clients" && !isAdmin ? (
                  <>
                    <Link
                      to={buildCallsClientHistoryHref(item.id)}
                      className="client-call-history-btn"
                      title="Открыть записи звонков по этому клиенту"
                    >
                      История звонков
                    </Link>
                    <button
                      type="button"
                      className="secondary-btn"
                      title="Создать страницу приглашения для клиента"
                      onClick={() => generateClientInviteLink(item.id)}
                    >
                      Ссылка для клиента
                    </button>
                  </>
                ) : null}
                <button type="button" className="create-primary-btn" onClick={() => startEdit(item)}>
                  Изменить
                </button>
                <button type="button" onClick={() => handleDelete(item.id)}>
                  Удалить
                </button>
              </>
            )}
          </footer>
        ) : null}
      </article>
    );
  };

  return (
    <section>
      <div className="actions actions-compact">
        <button type="button" onClick={reload} disabled={loading}>
          Обновить
        </button>
      </div>

      {!(resource.key === "calls" && !isAdmin) ? (
      <div className="resource-section-card">
        <div className="resource-section-head">
          <h3>{editingId ? `Редактирование #${editingId}` : "Создание записи"}</h3>
          <p className="hint">
            {editingId ? "Измените поля и сохраните." : "Заполните поля формы и создайте новую запись."}
          </p>
        </div>
        <form className={`form ${resource.key === "calls" ? "form-calls" : ""}`} onSubmit={handleSubmit}>
          {fields.map((field) => {
          if (resource.key === "calls" && ["duration", "endedAt"].includes(field)) {
            return null;
          }

          if (resource.key === "documents" && field === "clientId") {
            return (
              <label key={field} className="field">
                <span>{getFieldLabel(field)}</span>
                <select
                  value={toInputValue(formData.clientId)}
                  onChange={(event) => onChange("clientId", event.target.value)}
                >
                  <option value="">Выберите клиента</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatClientOptionLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (resource.key === "documents" && field === "filename") {
            return (
              <label key={field} className="field">
                <span>{getFieldLabel(field)}</span>
                <select
                  value={toInputValue(formData.filename)}
                  onChange={(event) => {
                    const fn = event.target.value;
                    const meta = uploadedDocsMeta.find((f) => f.filename === fn);
                    setFormData((prev) => ({
                      ...prev,
                      filename: fn,
                      ...(meta
                        ? { filePath: meta.filePath, fileSize: meta.fileSize, mimeType: meta.mimeType }
                        : {}),
                    }));
                  }}
                >
                  <option value="">Выберите загруженный файл</option>
                  {uploadedDocsMeta.map((f) => (
                    <option key={f.filename} value={f.filename}>
                      {f.filename} ({f.fileSize != null ? `${f.fileSize} Б` : "—"})
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (resource.key === "calls" && field === "recordingUrl") {
            return (
              <label key={field} className="field">
                <span>{getFieldLabel(field)}</span>
                <select
                  value={toInputValue(formData.recordingUrl)}
                  onChange={(event) => {
                    void applyCallRecordingMeta(event.target.value);
                  }}
                >
                  <option value="">Выберите запись (обязательно)</option>
                  {uploadedVoiceMeta.map((f) => (
                    <option key={f.filename} value={f.filePath}>
                      {f.filename}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (resource.key === "deals" && field === "amount") {
            return (
              <label key={field} className="field">
                <span>{getFieldLabel(field)} (Br)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Например: 15000"
                  value={toInputValue(formData.amount)}
                  onChange={(event) => onChange("amount", event.target.value)}
                />
              </label>
            );
          }

          if (resource.key === "deals" && field === "clientId") {
            const clientOptions = lookupOptionsByField.clientId || [];
            const selectedDocIds = Array.isArray(formData.documentIds) ? formData.documentIds : [];
            return (
              <div key="deals-client-documents" className="form-full-width">
                <label className="field">
                  <span>{getFieldLabel("clientId")}</span>
                  <select
                    value={toInputValue(formData.clientId)}
                    onChange={(event) => onChange("clientId", event.target.value)}
                  >
                    <option value="">Выберите</option>
                    {clientOptions.map((option) => (
                      <option key={`clientId-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{getFieldLabel("documentIds")}</span>
                  <select
                    multiple
                    disabled={!formData.clientId}
                    value={selectedDocIds}
                    onChange={(event) =>
                      onChange(
                        "documentIds",
                        Array.from(event.target.selectedOptions, (option) => option.value),
                      )
                    }
                  >
                    {clientDocumentsForDeal.map((doc) => (
                      <option key={doc.id} value={String(doc.id)}>
                        {doc.filename || `Документ #${doc.id}`}
                      </option>
                    ))}
                  </select>
                  {!formData.clientId ? (
                    <p className="hint">Сначала выберите клиента.</p>
                  ) : clientDocumentsForDeal.length === 0 ? (
                    <p className="hint">
                      Нет документов для этого клиента. Загрузите на вкладке «Загрузка документов».
                    </p>
                  ) : (
                    <p className="hint">Удерживайте Ctrl (или Cmd) для выбора нескольких документов.</p>
                  )}
                </label>
              </div>
            );
          }

          const fkOptions = lookupOptionsByField[field];
          if (Array.isArray(fkOptions) && fkOptions.length > 0) {
            return (
              <label key={field} className="field">
                <span>{getFieldLabel(field)}</span>
                <select value={toInputValue(formData[field])} onChange={(event) => onChange(field, event.target.value)}>
                  <option value="">Выберите</option>
                  {fkOptions.map((option) => (
                    <option key={`${field}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label key={field} className="field">
              <span>{getFieldLabel(field)}</span>
              {Array.isArray(fieldMetaMap[field]?.options) ? (
                <select value={toInputValue(formData[field])} onChange={(event) => onChange(field, event.target.value)}>
                  <option value="">Выберите</option>
                  {fieldMetaMap[field].options.map((option) => (
                    <option key={option} value={option}>
                      {getEnumOptionLabel(resource.key, field, option)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    resource.key === "clients" && field === "email"
                      ? "email"
                      : resource.key === "clients" && field === "phone"
                        ? "tel"
                        : fieldMetaMap[field]?.type === "date"
                          ? "date"
                          : fieldMetaMap[field]?.type === "datetime"
                            ? "datetime-local"
                            : "text"
                  }
                  placeholder={
                    resource.key === "clients" && field === "phone"
                      ? "+375291234567 или 80291234567"
                      : resource.key === "clients" && field === "email"
                        ? "name@example.com"
                        : undefined
                  }
                  min={
                    resource.key === "calls"
                      ? fieldMetaMap[field]?.type === "datetime"
                        ? datetimeMinValue
                        : fieldMetaMap[field]?.type === "date"
                          ? dateMinValue
                          : undefined
                      : !isAdmin && managerDbTabs.has(resource.key)
                      ? fieldMetaMap[field]?.type === "date"
                        ? dateMinValue
                        : fieldMetaMap[field]?.type === "datetime"
                          ? datetimeMinValue
                          : undefined
                      : undefined
                  }
                  value={toInputValue(formData[field])}
                  onChange={(event) => {
                    onChange(field, event.target.value);
                    if (resource.key === "calls" && field === "startedAt" && formData.recordingUrl) {
                      void applyCallRecordingMeta(formData.recordingUrl, event.target.value);
                    }
                  }}
                />
              )}
            </label>
          );
          })}
          {resource.key === "clients" ? (
            <ClientContactPointsEditor
              value={formData.contactPersons}
              onChange={(contactPersons) => onChange("contactPersons", contactPersons)}
            />
          ) : null}
          <div className="form-actions">
            <button type="submit" className={!editingId ? "create-primary-btn" : ""}>
              {editingId ? "Сохранить" : "Создать"}
            </button>
            {editingId ? (
              <button type="button" className="create-primary-btn" onClick={cancelEdit}>
                Отмена
              </button>
            ) : null}
          </div>
          {resource.key === "documents" ? (
            <p className="hint form-full-width">
              Список формируется из каталога uploads/docs (вкладка «Загрузка документов»). Новые файлы — PDF и документы
              Word (см. список расширений на той вкладке).
            </p>
          ) : null}
        </form>
      </div>
      ) : null}

      {status.text ? <p className={status.type === "error" ? "status error" : "status success"}>{status.text}</p> : null}
      {inviteStatus.text ? (
        <p className={inviteStatus.type === "error" ? "hint error" : "hint"}>{inviteStatus.text}</p>
      ) : null}

      <div className="resource-section-card resource-filters">
        <div className="resource-section-head">
          <h3>Фильтрация</h3>
          <p className="hint">Выберите поле и введите значение для отбора записей.</p>
        </div>
        <label className="field">
          <span>Поле фильтра</span>
          <select
            value={filterField}
            onChange={(event) => {
              setFilterField(event.target.value);
              setFilterValue("");
            }}
          >
            {filterableFields.map((field) => (
              <option key={`filter-field-${field}`} value={field}>
                {field === "all" ? "Все поля" : getFieldLabel(field)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Значение</span>
          <input
            type="text"
            placeholder={
              filterField === "all"
                ? "Например: иван, выполнена, +375..."
                : `Введите значение для ${getFieldLabel(filterField)}`
            }
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
          />
        </label>
        <div className="field sort-direction-field">
          <span>Порядок</span>
          <div className="sort-direction-row" role="group" aria-label="Порядок сортировки по ID">
            <button
              type="button"
              className={`sort-direction-chip ${sortDirection === "desc" ? "active" : ""}`}
              aria-pressed={sortDirection === "desc"}
              onClick={() => setSortDirection("desc")}
            >
              По убыванию
            </button>
            <button
              type="button"
              className={`sort-direction-chip ${sortDirection === "asc" ? "active" : ""}`}
              aria-pressed={sortDirection === "asc"}
              onClick={() => setSortDirection("asc")}
            >
              По возрастанию
            </button>
          </div>
        </div>
        {showStatusQuickFilters && quickFilterOptions.length > 0 ? (
          <div className="quick-filter-row">
            <button
              type="button"
              className={`quick-filter-chip ${quickFilter === "all" ? "active" : ""}`}
              onClick={() => setQuickFilter("all")}
            >
              Все
            </button>
            {quickFilterOptions.map((option) => (
              <button
                key={`quick-filter-${option.value}`}
                type="button"
                className={`quick-filter-chip ${quickFilter === option.value ? "active" : ""}`}
                onClick={() => setQuickFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="resource-filters-actions">
          <button
            type="button"
            onClick={() => {
              setFilterField("all");
              setFilterValue("");
              setQuickFilter("all");
              setSortDirection("desc");
              setListPage(1);
              navigate({ pathname: location.pathname, search: "" }, { replace: true });
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      </div>

      <div className="resource-list-head">
        <h3>Список записей</h3>
        <span className="status-badge" title="Записей после фильтров">
          {sortedItems.length}
        </span>
      </div>
      <ResourceListPagination
        page={listPagination.page}
        pageCount={listPagination.pageCount}
        rangeStart={listPagination.rangeStart}
        rangeEnd={listPagination.rangeEnd}
        total={listPagination.total}
        onPageChange={setListPage}
      />
      {callsClientFilterActive && callsClientFilterName ? (
        <p className="hint calls-client-filter-banner">
          История звонков клиента: <strong>{callsClientFilterName}</strong>
          {" · "}
          <Link to="/clients">← К клиентам</Link>
        </p>
      ) : null}
      {callsClientFilterActive ? (
        <div className="calls-history-by-day">
          {callGroups.length === 0 && !loading ? <p className="hint">Звонков по этому клиенту пока нет.</p> : null}
          {callGroups.map((group) => (
            <section key={group.key} className="calls-day-group">
              <h4 className="calls-day-group-title">{group.label}</h4>
              <div className="resource-cards">{group.items.map((item) => renderResourceCard(item))}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="resource-cards">
          {paginatedItems.map((item) => renderResourceCard(item))}
          {items.length === 0 && !loading ? <p className="hint">Нет данных</p> : null}
          {items.length > 0 && sortedItems.length === 0 && !loading ? (
            <p className="hint">По фильтрам совпадений нет</p>
          ) : null}
        </div>
      )}
      {sortedItems.length > RESOURCE_LIST_PAGE_SIZE ? (
        <ResourceListPagination
          page={listPagination.page}
          pageCount={listPagination.pageCount}
          rangeStart={listPagination.rangeStart}
          rangeEnd={listPagination.rangeEnd}
          total={listPagination.total}
          onPageChange={setListPage}
        />
      ) : null}
    </section>
  );
};

export default ResourcePanel;
