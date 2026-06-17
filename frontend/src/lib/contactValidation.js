const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const WEBSITE_PATTERN = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
const TELEGRAM_PATTERN = /^(@[\w]{5,32}|https?:\/\/(t\.me|telegram\.me)\/[\w]{5,32})$/i;
const SKYPE_PATTERN = /^(live:[\w.,-]{6,32}|[\w.,-]{6,32})$/i;
const INSTAGRAM_PATTERN = /^(@[\w.]{1,30}|https?:\/\/(www\.)?instagram\.com\/[\w.]{1,30}\/?)$/i;
const VK_PATTERN = /^(https?:\/\/)?(www\.)?(vk\.com|vkontakte\.ru)\/[\w.-]+\/?$/i;
const OK_PATTERN = /^(https?:\/\/)?(www\.)?ok\.ru\/[\w.-]+\/?$/i;
const LINKEDIN_PATTERN = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w%-]+\/?$/i;

const MOBILE_PREFIXES = ["29", "33", "44", "25", "16"];

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const isValidBelarusNational = (nine) => nine.length === 9 && /^[1-9]\d{8}$/.test(nine);

/**
 * @param {string} email
 * @returns {string|null}
 */
export const validateEmail = (email) => {
  const trimmed = String(email || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Некорректный адрес электронной почты.";
  }
  return null;
};

/**
 * @param {string} phone
 * @returns {string|null}
 */
export const validateBelarusPhone = (phone) => {
  const trimmed = String(phone || "").trim();
  if (!trimmed) {
    return null;
  }

  const d = digitsOnly(trimmed);

  if (d.startsWith("375") && d.length === 12 && isValidBelarusNational(d.slice(3))) {
    return null;
  }
  if (d.startsWith("80") && d.length === 11 && isValidBelarusNational(d.slice(2))) {
    return null;
  }
  if (d.length === 9 && isValidBelarusNational(d)) {
    return null;
  }

  return "Некорректный телефон. Используйте +375..., 375... или 80... (9 цифр номера после кода страны).";
};

export const validateBelarusLandline = (phone) => {
  const trimmed = String(phone || "").trim();
  if (!trimmed) {
    return null;
  }

  const d = digitsOnly(trimmed);
  let national = "";

  if (d.startsWith("375") && (d.length === 11 || d.length === 12)) {
    national = d.slice(3);
  } else if (d.startsWith("80") && (d.length === 10 || d.length === 11)) {
    national = d.slice(2);
  } else if (d.length === 8 || d.length === 9) {
    national = d;
  } else {
    return "Некорректный городской телефон. Пример: +375171234567, +375152123456 или 80171234567.";
  }

  if (national.length === 9 && MOBILE_PREFIXES.some((prefix) => national.startsWith(prefix))) {
    return "Указан мобильный номер — выберите тип «Мобильный телефон».";
  }

  if (national.length >= 8 && national.length <= 9) {
    return null;
  }

  return "Некорректный городской телефон. Пример: +375171234567, +375152123456 или 80171234567.";
};

export const validateBelarusAnyPhone = (phone) =>
  validateBelarusPhone(phone) || validateBelarusLandline(phone);

export const validateWebsite = (url) => {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!WEBSITE_PATTERN.test(trimmed)) {
    return "Некорректный адрес сайта. Пример: https://example.by или example.by.";
  }
  return null;
};

export const validateTelegram = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!TELEGRAM_PATTERN.test(trimmed)) {
    return "Укажите Telegram: @username или ссылку t.me/username.";
  }
  return null;
};

export const validateSkype = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!SKYPE_PATTERN.test(trimmed)) {
    return "Укажите логин Skype, например live:username.";
  }
  return null;
};

export const validateInstagram = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!INSTAGRAM_PATTERN.test(trimmed)) {
    return "Укажите Instagram: @username или ссылку instagram.com/username.";
  }
  return null;
};

export const validateVk = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!VK_PATTERN.test(trimmed)) {
    return "Укажите ссылку ВКонтакте, например vk.com/company.";
  }
  return null;
};

export const validateOk = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!OK_PATTERN.test(trimmed)) {
    return "Укажите ссылку Одноклассники, например ok.ru/profile/123456.";
  }
  return null;
};

export const validateLinkedIn = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (!LINKEDIN_PATTERN.test(trimmed)) {
    return "Укажите ссылку LinkedIn, например linkedin.com/in/username.";
  }
  return null;
};

export const validateClientContactPointValue = (type, value) => {
  const normalizedType = String(type || "").trim().toLowerCase();

  switch (normalizedType) {
    case "email":
      return validateEmail(value);
    case "mobile":
    case "viber":
    case "whatsapp":
      return validateBelarusPhone(value);
    case "fax": {
      const phoneError = validateBelarusPhone(value);
      return phoneError ? phoneError.replace("телефон", "факс") : null;
    }
    case "landline":
      return validateBelarusLandline(value);
    case "phone":
      return validateBelarusAnyPhone(value);
    case "website":
      return validateWebsite(value);
    case "telegram":
      return validateTelegram(value);
    case "skype":
      return validateSkype(value);
    case "instagram":
      return validateInstagram(value);
    case "vk":
      return validateVk(value);
    case "ok":
      return validateOk(value);
    case "linkedin":
      return validateLinkedIn(value);
    default:
      return null;
  }
};
