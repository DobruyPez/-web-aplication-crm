/** Допустимые типы контактных точек клиента (Беларусь, CRM). */
const CLIENT_CONTACT_POINT_TYPES = [
  "mobile",
  "landline",
  "phone",
  "fax",
  "email",
  "website",
  "telegram",
  "viber",
  "whatsapp",
  "skype",
  "instagram",
  "vk",
  "ok",
  "linkedin",
];

const CLIENT_CONTACT_POINT_LABELS = {
  mobile: "Телефон",
  landline: "Телефон",
  phone: "Телефон",
  fax: "Факс",
  email: "Электронная почта",
  website: "Веб-сайт",
  telegram: "Telegram",
  viber: "Viber",
  whatsapp: "WhatsApp",
  skype: "Skype",
  instagram: "Instagram",
  vk: "ВКонтакте",
  ok: "Одноклассники",
  linkedin: "LinkedIn",
};

const PHONE_LIKE_TYPES = new Set(["mobile", "phone", "fax", "viber", "whatsapp"]);
const LEGACY_PHONE_TYPES = new Set(["phone", "mobile", "landline"]);

module.exports = {
  CLIENT_CONTACT_POINT_TYPES,
  CLIENT_CONTACT_POINT_LABELS,
  PHONE_LIKE_TYPES,
  LEGACY_PHONE_TYPES,
};
