import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createItem, deleteItem, fetchList, fetchUploadedDocFiles, fetchUploadedVoiceFiles, updateItem } from "../api";
import { useAuth } from "../authContext";
import { API_ORIGIN, DEAL_STAGES, RESOURCE_SORT_FIELDS, TASK_PRIORITIES, TASK_STATUSES } from "../config";
import { formatRef, sortLoadedRecords } from "../lib/loadedTableSort";
import { DASHBOARD_DEEP_FILTER_FIELDS } from "../lib/dashboardDeepLink";
import { groupCallsByDay } from "../lib/callHistoryGroups";
import { buildCallsClientHistoryHref, parseListViewSearchParams } from "../lib/listViewQuery";
import { deriveDealsPanelStateFromSearch } from "../lib/syncDealsFromUrl.js";
import { dealMatchesDashboardRisk, taskMatchesDashboardBucket } from "../lib/managerTaskBuckets";

/** Поля сортировки из URL для /deals — без ожидания загрузки items (sortableFields). */
const DEALS_URL_SORT_FIELDS = new Set(["id", ...RESOURCE_SORT_FIELDS.deals]);

/** Начальное состояние блока «Фильтрация» при F5: до useLayoutEffect первый кадр уже совпадает с query. */
function initialDealsPanelFiltersFromSearch(search, resourceFields) {
  const d = deriveDealsPanelStateFromSearch(search, resourceFields);
  const sortField = d.sortField && DEALS_URL_SORT_FIELDS.has(d.sortField) ? d.sortField : "id";
  const sortDirection = d.sortDirection === "asc" ? "asc" : "desc";
  return {
    searchText: d.searchText,
    filterField: d.filterField,
    filterValue: d.filterValue,
    quickFilter: d.quickFilter,
    sortField,
    sortDirection,
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
  deals: "title",
  tasks: "title",
  calls: "id",
  documents: "filename",
  users: "fullName",
};
const FIELD_LABELS = {
  id: "ID",
  fullName: "ФИО",
  email: "Email",
  password: "Пароль",
  role: "Роль",
  phone: "Телефон",
  telegramLink: "Telegram ссылка",
  telegramChatId: "Telegram Chat ID",
  name: "Имя",
  company: "Компания",
  address: "Адрес",
  notes: "Заметки",
  managerId: "Менеджер",
  title: "Название",
  description: "Описание",
  amount: "Сумма",
  stage: "Этап",
  closingDate: "Дата закрытия",
  clientId: "Клиент",
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
  mimeType: "MIME-тип",
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

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(parsed);
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
      ["Имя", item.name || "—"],
      ["Компания", item.company || "—"],
      ["Телефон", item.phone || "—"],
      ["Email", item.email || "—"],
      ["Адрес", item.address || "—"],
      ["Менеджер", formatRef(item.managerId, usersMap, "fullName")],
      ["Заметки", item.notes || "—"],
    ];
  }

  if (resourceKey === "deals") {
    return [
      ["Название", item.title || "—"],
      ["Этап", prettify(item.stage || "new")],
      ["Сумма", formatMoney(item.amount)],
      ["Дата закрытия", formatDateLike(item.closingDate)],
      ["Клиент", formatRef(item.clientId, clientsMap, "name")],
      ["Менеджер", formatRef(item.managerId, usersMap, "fullName")],
      ["Описание", item.description || "—"],
    ];
  }

  if (resourceKey === "tasks") {
    return [
      ["Название", item.title || "—"],
      ["Статус", prettify(item.status || "new")],
      ["Приоритет", prettify(item.priority || "medium")],
      ["Срок", formatDateTimeLike(item.dueDate)],
      ["Автор", formatRef(item.authorId, usersMap, "fullName")],
      ["Клиент", formatRef(item.clientId, clientsMap, "name")],
      ["Сделка", formatRef(item.dealId, dealsMap, "title")],
      ["Описание", item.description || "—"],
    ];
  }

  if (resourceKey === "documents") {
    const href = item.filePath ? encodeURI(`${API_ORIGIN}${item.filePath}`) : null;
    const clientLabel = item.client?.name || formatRef(item.clientId, clientsMap, "name");
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
    const clientLabel = item.client?.name || formatRef(item.clientId, clientsMap, "name");
    const callerLabel = item.caller?.fullName || formatRef(item.callerId, usersMap, "fullName");
    return [
      ["Клиент", clientLabel],
      ["Оператор", callerLabel],
      ["Направление", item.direction || "—"],
      ["Статус", item.status || "—"],
      ["Длительность", item.duration ?? "—"],
      ["Начало", formatDateTimeLike(item.startedAt)],
      ["Завершение", formatDateTimeLike(item.endedAt)],
      [
        "Голосовая",
        href ? (
          <audio controls className="call-audio-table" src={href}>
            <a href={href} target="_blank" rel="noreferrer">
              открыть запись
            </a>
          </audio>
        ) : (
          "—"
        ),
      ],
    ];
  }

  if (resourceKey === "users") {
    return [
      ["ФИО", item.fullName || "—"],
      ["Email", item.email || "—"],
      ["Роль", prettify(item.role || "manager")],
      ["Телефон", item.phone || "—"],
      [
        "Telegram",
        item.telegramLink ? (
          <a href={item.telegramLink} target="_blank" rel="noreferrer">
            профиль
          </a>
        ) : (
          "—"
        ),
      ],
      ["Telegram Chat ID", item.telegramChatId || "—"],
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
  const [searchText, setSearchText] = useState(() => dealsPanelMountSeed(resource, location)?.searchText ?? "");
  const [filterField, setFilterField] = useState(() => dealsPanelMountSeed(resource, location)?.filterField ?? "all");
  const [filterValue, setFilterValue] = useState(() => dealsPanelMountSeed(resource, location)?.filterValue ?? "");
  const [quickFilter, setQuickFilter] = useState(() => dealsPanelMountSeed(resource, location)?.quickFilter ?? "all");
  const [sortField, setSortField] = useState(() => dealsPanelMountSeed(resource, location)?.sortField ?? "id");
  const [sortDirection, setSortDirection] = useState(
    () => dealsPanelMountSeed(resource, location)?.sortDirection ?? "desc",
  );
  const [formData, setFormData] = useState({});
  const [status, setStatus] = useState({ type: "idle", text: "" });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploadedDocsMeta, setUploadedDocsMeta] = useState([]);
  const [uploadedVoiceMeta, setUploadedVoiceMeta] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [dealsList, setDealsList] = useState([]);

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

    if (resource.key === "deals") {
      options.clientId = clientsList.map((client) => ({
        value: String(client.id),
        label: client.name || `ID ${client.id}`,
      }));
    }

    if (resource.key === "tasks") {
      options.clientId = clientsList.map((client) => ({
        value: String(client.id),
        label: client.name || `ID ${client.id}`,
      }));
      options.dealId = dealsList.map((deal) => ({
        value: String(deal.id),
        label: deal.title || `Сделка #${deal.id}`,
      }));
    }

    if (resource.key === "calls") {
      options.clientId = clientsList.map((client) => ({
        value: String(client.id),
        label: client.name || `ID ${client.id}`,
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
    if (Array.isArray(resource.fields) && resource.fields.length > 0) {
      return resource.fields.map((field) => field.name);
    }
    if (items.length > 0 && resource.requiredFields.length > 0) {
      return Object.keys(items[0]).filter((key) => resource.requiredFields.includes(key));
    }
    return resource.requiredFields;
  }, [items, resource.fields, resource.requiredFields]);
  const filterableFields = useMemo(() => ["all", "id", ...fields], [fields]);

  const itemKeysSet = useMemo(() => {
    const s = new Set(fields);
    if (items.length > 0 && items[0] && typeof items[0] === "object") {
      Object.keys(items[0]).forEach((k) => s.add(k));
    }
    return s;
  }, [fields, items]);

  const sortableFields = useMemo(() => {
    const preferred = RESOURCE_SORT_FIELDS[resource.key];
    if (!Array.isArray(preferred) || preferred.length === 0) {
      return ["id", ...fields];
    }
    const tail = preferred.filter((name) => itemKeysSet.has(name));
    return ["id", ...tail];
  }, [resource.key, fields, itemKeysSet]);

  /* Для сделок порядок и поле сортировки задаются из URL (applyDealsListFromUrl); этот эффект иначе затирал sortField из query после загрузки items. */
  useEffect(() => {
    if (resource.key === "deals") {
      return;
    }
    const allowed = new Set(sortableFields);
    setSortField((prev) => (allowed.has(prev) ? prev : "id"));
  }, [resource.key, sortableFields.join("|")]);

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
      const needUploadMeta = resource.key === "documents";
      const needVoiceMeta = resource.key === "calls";

      const [meta, voiceMeta, clientRows, userRows, dealRows] = await Promise.all([
        needUploadMeta ? fetchUploadedDocFiles() : Promise.resolve([]),
        needVoiceMeta ? fetchUploadedVoiceFiles() : Promise.resolve([]),
        needClients ? fetchList("clients") : Promise.resolve([]),
        needUsers ? fetchList("users").catch(() => []) : Promise.resolve([]),
        needDeals ? fetchList("deals") : Promise.resolve([]),
      ]);

      setUploadedDocsMeta(meta);
      setUploadedVoiceMeta(voiceMeta);
      setClientsList(clientRows);
      setUsersList(userRows);
      setDealsList(dealRows);
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
    setSearchText(d.searchText);
    setFilterField(d.filterField);
    setFilterValue(d.filterValue);
    setQuickFilter(d.quickFilter);
    const sig = `${resource.key}|${search}`;
    const urlBundleChanged = lastUrlSigRef.current !== sig;
    lastUrlSigRef.current = sig;
    if (d.sortField && DEALS_URL_SORT_FIELDS.has(d.sortField)) {
      setSortField(d.sortField);
      setSortDirection(d.sortDirection === "asc" ? "asc" : "desc");
    } else if (urlBundleChanged && !d.sortField) {
      setSortField("id");
      setSortDirection("desc");
    }
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
    setFormData({ ...defaults });
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
    setSearchText(params.searchText);
    setFilterField(ff);
    setFilterValue(fv);
    setQuickFilter(params.quickFilter);

    const sig = `${resource.key}|${location.search}`;
    const urlBundleChanged = lastUrlSigRef.current !== sig;
    lastUrlSigRef.current = sig;

    if (params.sortField && sortableFields.includes(params.sortField)) {
      setSortField(params.sortField);
      setSortDirection(params.sortDirection === "asc" ? "asc" : "desc");
    } else if (resource.key === "calls" && ff === "clientId" && fv) {
      setSortField("startedAt");
      setSortDirection("desc");
    } else if (urlBundleChanged && !params.sortField) {
      setSortField(resource.key === "calls" ? "startedAt" : "id");
      setSortDirection("desc");
    }
  }, [resource.key, location.search, fieldNamesKey, sortableFields.join("|")]);

  const onChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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
        return `Поле "${required}" обязательно`;
      }
    }

    // Для менеджера на рабочих вкладках: дата/время не может быть раньше текущего момента.
    if (!isAdmin && managerDbTabs.has(resource.key)) {
      for (const field of fields) {
        const meta = fieldMetaMap[field];
        if ((meta?.type === "date" || meta?.type === "datetime") && formData[field]) {
          const parsed = new Date(formData[field]);
          if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) {
            return `Поле "${field}" не может быть раньше текущей даты и времени`;
          }
        }
      }
    }

    if (resource.key === "deals") {
      if (formData.title && String(formData.title).trim().length < 3) {
        return 'Поле "title" должно содержать минимум 3 символа';
      }
      if (formData.amount !== undefined && formData.amount !== null && formData.amount !== "") {
        const amount = Number(formData.amount);
        if (Number.isNaN(amount) || amount < 0) {
          return 'Поле "amount" должно быть числом >= 0';
        }
      }
      if (formData.stage && !DEAL_STAGES.includes(normalizeEnum(formData.stage))) {
        return `Поле "stage" должно быть одним из: ${DEAL_STAGES.join(", ")}`;
      }
    }

    if (resource.key === "tasks") {
      if (formData.title && String(formData.title).trim().length < 3) {
        return 'Поле "title" должно содержать минимум 3 символа';
      }
      if (formData.status && !TASK_STATUSES.includes(normalizeEnum(formData.status))) {
        return `Поле "status" должно быть одним из: ${TASK_STATUSES.join(", ")}`;
      }
      if (formData.priority && !TASK_PRIORITIES.includes(normalizeEnum(formData.priority))) {
        return `Поле "priority" должно быть одним из: ${TASK_PRIORITIES.join(", ")}`;
      }
    }

    if (resource.key === "documents") {
      const fn = formData.filename ? String(formData.filename).trim() : "";
      if (fn && !uploadedDocsMeta.some((f) => f.filename === fn)) {
        return "Выберите файл из списка загруженных на сервере (вкладка «Управление документами»).";
      }
    }

    if (resource.key === "calls") {
      const requiredCallFields = ["clientId", "callerId", "direction", "status", "startedAt"];
      for (const requiredField of requiredCallFields) {
        if (formData[requiredField] === undefined || formData[requiredField] === null || formData[requiredField] === "") {
          return `Поле "${requiredField}" обязательно`;
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
        return `Поле "direction" должно быть одним из: ${CALL_DIRECTIONS.join(", ")}`;
      }
      if (formData.status && !CALL_STATUSES.includes(normalizeEnum(formData.status))) {
        return `Поле "status" должно быть одним из: ${CALL_STATUSES.join(", ")}`;
      }
      if (formData.duration !== undefined && formData.duration !== null && formData.duration !== "") {
        const duration = Number(formData.duration);
        if (Number.isNaN(duration) || duration < 0) {
          return 'Поле "duration" должно быть числом >= 0';
        }
      }
      if (formData.startedAt) {
        const startedAt = new Date(formData.startedAt);
        if (Number.isNaN(startedAt.getTime())) {
          return 'Поле "startedAt" содержит некорректную дату/время';
        }
        if (startedAt.getTime() < Date.now()) {
          return 'Поле "startedAt" не может быть раньше текущих даты и времени';
        }
      }
      if (formData.endedAt) {
        const endedAt = new Date(formData.endedAt);
        if (Number.isNaN(endedAt.getTime())) {
          return 'Поле "endedAt" содержит некорректную дату/время';
        }
        if (endedAt.getTime() < Date.now()) {
          return 'Поле "endedAt" не может быть раньше текущих даты и времени';
        }
        if (formData.startedAt) {
          const startedAt = new Date(formData.startedAt);
          if (!Number.isNaN(startedAt.getTime()) && endedAt.getTime() < startedAt.getTime()) {
            return 'Поле "endedAt" не может быть раньше "startedAt"';
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

    return { ...defaults, ...payload };
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
      setFormData({ ...defaults });
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
    setFormData(next);
    setEditingId(item.id);
    setStatus({ type: "idle", text: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ ...defaults });
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
      { value: "admin", label: "Admin", field: "role" },
      { value: "manager", label: "Manager", field: "role" },
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
    const q = searchText.trim().toLowerCase();
    const ff = filterField;
    const fvTrim = filterValue.trim();
    const fv = fvTrim.toLowerCase();

    return items.filter((item) => {
      const searchHaystack = [
        ...Object.values(item || {}).map((v) => String(v ?? "")),
        ...getCardRows(resource.key, item, { clientsById, usersById: usersByIdWithCurrent, dealsById }).map(([, value]) =>
          typeof value === "string" || typeof value === "number" ? String(value) : "",
        ),
      ]
        .join(" ")
        .toLowerCase();
      const passSearch = q ? searchHaystack.includes(q) : true;

      let passFieldFilter = true;
      if (fv) {
        if (ff === "all") {
          passFieldFilter = Object.values(item || {})
            .map((v) => String(v ?? "").toLowerCase())
            .some((v) => v.includes(fv));
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

      return passSearch && passFieldFilter && passQuickFilter && passListBucket && passListRisk;
    });
  }, [
    searchText,
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
        sortField,
        sortDirection,
        fieldMetaMap,
        clientsById,
        dealsById,
        usersByIdWithCurrent,
      }),
    [filteredItems, sortField, sortDirection, fieldMetaMap, clientsById, dealsById, usersByIdWithCurrent],
  );

  const callsClientFilterActive =
    resource.key === "calls" && filterField === "clientId" && String(filterValue || "").trim() !== "";
  const callsClientFilterName = callsClientFilterActive ? formatRef(filterValue, clientsById, "name") : null;
  const callGroups = useMemo(
    () => (callsClientFilterActive ? groupCallsByDay(sortedItems) : []),
    [callsClientFilterActive, sortedItems],
  );

  const renderResourceCard = (item) => {
    const isProtectedAdmin =
      resource.key === "users" && String(item.role || "").trim().toLowerCase() === "admin";
    return (
      <article key={item.id} className="resource-card">
        <header className="resource-card-header">
          <div className="resource-card-title">
            <h3>{item?.[RESOURCE_PRIMARY_FIELD[resource.key]] || `Запись #${item.id}`}</h3>
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
        {showRowActions ? (
          <footer className="resource-card-actions">
            {isProtectedAdmin ? (
              <p className="hint" style={{ margin: 0 }}>
                Роль администратора — только БД; редактирование и удаление недоступны.
              </p>
            ) : (
              <>
                {resource.key === "clients" && !isAdmin ? (
                  <Link
                    to={buildCallsClientHistoryHref(item.id)}
                    className="client-call-history-btn"
                    title="Открыть записи звонков по этому клиенту"
                  >
                    История звонков
                  </Link>
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
                      {c.name}
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

          const fkOptions = lookupOptionsByField[field];
          if (Array.isArray(fkOptions) && fkOptions.length > 0 && (!isAdmin || resource.key === "calls")) {
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
                      {prettify(option)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    fieldMetaMap[field]?.type === "date"
                      ? "date"
                      : fieldMetaMap[field]?.type === "datetime"
                        ? "datetime-local"
                        : "text"
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
              Список формируется из каталога uploads/docs (вкладка «Управление документами»). Новые файлы — PDF и документы
              Word (см. список расширений на той вкладке).
            </p>
          ) : null}
        </form>
      </div>

      {status.text ? <p className={status.type === "error" ? "status error" : "status success"}>{status.text}</p> : null}

      <div className="resource-section-card resource-filters">
        <div className="resource-section-head">
          <h3>Фильтрация</h3>
          <p className="hint">Отберите записи по поисковому запросу или конкретному полю.</p>
        </div>
        <label className="field">
          <span>Поиск</span>
          <input
            type="text"
            placeholder="Поиск по карточкам..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>
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
              filterField === "all" ? "Например: ivan, done, +7..." : `Введите значение для ${getFieldLabel(filterField)}`
            }
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Сортировка по</span>
          <select value={sortField} onChange={(event) => setSortField(event.target.value)}>
            {sortableFields.map((field) => (
              <option key={`sort-field-${field}`} value={field}>
                {getFieldLabel(field)}
              </option>
            ))}
          </select>
        </label>
        <div className="field sort-direction-field">
          <span>Порядок</span>
          <div className="sort-direction-row" role="group" aria-label="Порядок сортировки">
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
              setSearchText("");
              setFilterField("all");
              setFilterValue("");
              setQuickFilter("all");
              setSortField("id");
              setSortDirection("desc");
              navigate({ pathname: location.pathname, search: "" }, { replace: true });
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      </div>

      <div className="resource-list-head">
        <h3>Список записей</h3>
        <span className="status-badge">{sortedItems.length}</span>
      </div>
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
          {sortedItems.map((item) => renderResourceCard(item))}
          {items.length === 0 && !loading ? <p className="hint">Нет данных</p> : null}
          {items.length > 0 && sortedItems.length === 0 && !loading ? (
            <p className="hint">По фильтрам совпадений нет</p>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default ResourcePanel;
