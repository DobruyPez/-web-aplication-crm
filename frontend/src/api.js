import { API_BASE_URL, UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS, UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS } from "./config";

export const assertAllowedManagementUploadName = (fileName, allowedExtList = UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS) => {
  const lower = String(fileName || "").toLowerCase();
  const ok = allowedExtList.some((ext) => lower.endsWith(ext.toLowerCase()));
  if (!ok) {
    throw new Error(
      `Допускаются только PDF и документы Word (${[...allowedExtList].sort().join(", ")}).`,
    );
  }
};

export const assertAllowedVoiceUploadName = (fileName, allowedExtList = UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS) => {
  const lower = String(fileName || "").toLowerCase();
  const ok = allowedExtList.some((ext) => lower.endsWith(ext.toLowerCase()));
  if (!ok) {
    throw new Error(`Допускаются только аудиофайлы (${[...allowedExtList].sort().join(", ")}).`);
  }
};

const authHeadersMultipart = () => {
  const token = localStorage.getItem("crm_auth_token");
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const getToken = () => localStorage.getItem("crm_auth_token");

const authHeaders = () => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const toErrorMessage = async (response) => {
  try {
    const payload = await response.json();
    return payload.message || "Request failed";
  } catch (_error) {
    return "Request failed";
  }
};

export const fetchList = async (resource) => {
  const response = await fetch(`${API_BASE_URL}/${resource}`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const createItem = async (resource, payload) => {
  const response = await fetch(`${API_BASE_URL}/${resource}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const updateItem = async (resource, id, payload) => {
  const response = await fetch(`${API_BASE_URL}/${resource}/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const deleteItem = async (resource, id) => {
  const response = await fetch(`${API_BASE_URL}/${resource}/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const authLogin = async (body) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const authMe = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const fetchDashboardOverview = async () => {
  const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

/** Файлы в uploads/docs (метаданные с сервера). */
export const fetchUploadedDocFiles = async () => {
  const response = await fetch(`${API_BASE_URL}/uploads/docs`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

/** Загрузка файла в uploads/docs (multipart). */
export const uploadDocFileToServer = async (file, allowedExtensions = UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS) => {
  assertAllowedManagementUploadName(file?.name, allowedExtensions);

  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${API_BASE_URL}/uploads/docs`, {
    method: "POST",
    headers: authHeadersMultipart(),
    body,
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

/** Удалить файл из uploads/docs (индекс и файл на диске). */
export const deleteUploadedDocFileFromServer = async (filename) => {
  const q = `?filename=${encodeURIComponent(filename)}`;
  const response = await fetch(`${API_BASE_URL}/uploads/docs${q}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const fetchUploadedVoiceFiles = async () => {
  const response = await fetch(`${API_BASE_URL}/uploads/voice`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const uploadVoiceFileToServer = async (file, allowedExtensions = UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS) => {
  assertAllowedVoiceUploadName(file?.name, allowedExtensions);

  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${API_BASE_URL}/uploads/voice`, {
    method: "POST",
    headers: authHeadersMultipart(),
    body,
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const deleteUploadedVoiceFileFromServer = async (filename) => {
  const q = `?filename=${encodeURIComponent(filename)}`;
  const response = await fetch(`${API_BASE_URL}/uploads/voice${q}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};
