import { API_BASE_URL, UPLOAD_MANAGEMENT_ALLOWED_EXTENSIONS, UPLOAD_MANAGEMENT_ALLOWED_VOICE_EXTENSIONS } from "./config";

/** Без JWT — публичная страница клиента по guestToken. */
const publicApiHeaders = (json = true) => {
  const headers = {};
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

/** Bearer только если пользователь залогинен — для публичных join/invite. */
const optionalAuthHeaders = (json = true) => {
  const token = localStorage.getItem("crm_auth_token");
  const headers = {};
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

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
    return payload.message || "Запрос не выполнен";
  } catch (_error) {
    return "Запрос не выполнен";
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

export const fetchClientInvitePublic = async (token) => {
  const response = await fetch(`${API_BASE_URL}/client-invite/${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const createClientInviteLink = async (clientId) => {
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}/invite-link`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const createVideoSession = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/video-sessions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const fetchVideoSession = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/video-sessions/${sessionId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const fetchVideoJoinMeta = async (guestToken) => {
  const response = await fetch(`${API_BASE_URL}/video-sessions/join/${encodeURIComponent(guestToken)}`, {
    headers: publicApiHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const registerVideoJoin = async (guestToken, peerId) => {
  const response = await fetch(`${API_BASE_URL}/video-sessions/join/${encodeURIComponent(guestToken)}`, {
    method: "POST",
    headers: optionalAuthHeaders(),
    body: JSON.stringify({ peerId }),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const fetchVideoPublicHint = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/video-sessions/${sessionId}/public-hint`);
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const startVideoFromClientInvite = async (token) => {
  const response = await fetch(`${API_BASE_URL}/client-invite/${encodeURIComponent(token)}/start-video`, {
    method: "POST",
    headers: optionalAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const endVideoSession = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/video-sessions/${sessionId}/end`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};

export const uploadVideoSessionRecording = async (sessionId, blob) => {
  const body = new FormData();
  const name = `session-${sessionId}-${Date.now()}.webm`;
  body.append("file", blob, name);
  const response = await fetch(`${API_BASE_URL}/video-sessions/${sessionId}/recording`, {
    method: "POST",
    headers: authHeadersMultipart(),
    body,
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
  return response.json();
};
