import { validateClientContactPointValue } from "./contactValidation";



export const CONTACT_POINT_TYPES = [

  { value: "phone", label: "Телефон", inputType: "tel" },

  { value: "fax", label: "Факс", inputType: "tel" },

  { value: "email", label: "Электронная почта", inputType: "email" },

  { value: "website", label: "Веб-сайт", inputType: "url" },

  { value: "telegram", label: "Telegram", inputType: "text" },

  { value: "viber", label: "Viber", inputType: "tel" },

  { value: "whatsapp", label: "WhatsApp", inputType: "tel" },

  { value: "skype", label: "Skype", inputType: "text" },

  { value: "instagram", label: "Instagram", inputType: "text" },

  { value: "vk", label: "ВКонтакте", inputType: "text" },

  { value: "ok", label: "Одноклассники", inputType: "text" },

  { value: "linkedin", label: "LinkedIn", inputType: "text" },

];



export const CONTACT_POINT_TYPE_LABELS = {

  ...Object.fromEntries(CONTACT_POINT_TYPES.map((item) => [item.value, item.label])),

  mobile: "Телефон",

  landline: "Телефон",

};



const PLACEHOLDERS = {

  phone: "+375291234567 или +375171234567",

  fax: "+375172345678",

  email: "name@example.com",

  website: "https://example.by",

  telegram: "@username или t.me/username",

  viber: "+375291234567",

  whatsapp: "+375291234567",

  skype: "live:username",

  instagram: "@username или instagram.com/username",

  vk: "vk.com/company",

  ok: "ok.ru/profile/123456",

  linkedin: "linkedin.com/in/username",

};



export const getContactPointPlaceholder = (type) =>

  PLACEHOLDERS[type] || "Значение контакта";



export const getContactPointInputType = (type) => {

  const normalized = normalizeContactPointTypeForForm(type);

  return CONTACT_POINT_TYPES.find((item) => item.value === normalized)?.inputType || "text";

};



/** В UI один тип «Телефон»; старые mobile/landline приводим к phone. */

export const normalizeContactPointTypeForForm = (type) => {

  const t = String(type || "").trim().toLowerCase();

  if (t === "mobile" || t === "landline") {

    return "phone";

  }

  return t || "phone";

};



export const emptyContactChannel = () => ({

  type: "phone",

  value: "",

});



export const emptyContactPerson = () => ({

  fullName: "",

  role: "",

  channels: [emptyContactChannel()],

});



const DEFAULT_LEGACY_CONTACT_NAME = "Основной контакт";



function groupFlatPointsToPersons(points) {

  const order = [];

  const map = new Map();



  for (const point of points) {

    const key = String(point.contactName || DEFAULT_LEGACY_CONTACT_NAME).trim() || DEFAULT_LEGACY_CONTACT_NAME;

    if (!map.has(key)) {

      map.set(key, {

        fullName: key,

        role: point.personRole ?? "",

        channels: [],

      });

      order.push(key);

    }

    const person = map.get(key);

    if (point.value) {

      person.channels.push({

        type: normalizeContactPointTypeForForm(point.type),

        value: point.value,

      });

    }

  }



  return order.map((key) => map.get(key));

}



/**

 * Контактные лица для карточки/формы: API contactPersons, contactPoints или phone/email.

 */

export const resolveContactPersonsForDisplay = (client) => {

  const fromApi = Array.isArray(client?.contactPersons) ? client.contactPersons : [];

  if (fromApi.length > 0) {

    return fromApi.map((person) => ({

      id: person.id,

      fullName: person.fullName ?? "",

      role: person.role ?? "",

      channels: (person.channels || []).map((channel) => ({

        id: channel.id,

        type: normalizeContactPointTypeForForm(channel.type),

        value: channel.value ?? "",

      })),

    }));

  }



  const fromPoints = Array.isArray(client?.contactPoints) ? client.contactPoints : [];

  if (fromPoints.length > 0) {

    return groupFlatPointsToPersons(fromPoints);

  }



  const legacy = [];

  const phone = String(client?.phone ?? "").trim();

  const email = String(client?.email ?? "").trim();



  if (phone) {

    legacy.push({

      type: "phone",

      value: phone,

      contactName: DEFAULT_LEGACY_CONTACT_NAME,

    });

  }

  if (email) {

    legacy.push({

      type: "email",

      value: email.toLowerCase(),

      contactName: DEFAULT_LEGACY_CONTACT_NAME,

    });

  }



  return groupFlatPointsToPersons(legacy);

};



/** Плоский список точек (поиск, обратная совместимость). */

export const resolveContactPointsForDisplay = (client) => {

  const persons = resolveContactPersonsForDisplay(client);

  return persons.flatMap((person) =>

    (person.channels || []).map((channel) => ({

      type: channel.type,

      value: channel.value,

      contactName: person.fullName,

      personRole: person.role,

    })),

  );

};



export const normalizeContactPersonsForForm = (persons) => {

  const list = resolveContactPersonsForDisplay(

    Array.isArray(persons)

      ? { contactPersons: persons }

      : persons?.contactPersons

        ? persons

        : { contactPoints: persons },

  );



  if (!list.length) {

    return [emptyContactPerson()];

  }



  return list.map((person) => ({

    fullName: person.fullName ?? "",

    role: person.role ?? "",

    channels:

      person.channels?.length > 0

        ? person.channels.map((channel) => ({

            type: normalizeContactPointTypeForForm(channel.type),

            value: channel.value ?? "",

          }))

        : [emptyContactChannel()],

  }));

};



/** @deprecated используйте normalizeContactPersonsForForm */

export const normalizeContactPointsForForm = (points) =>

  normalizeContactPersonsForForm(

    Array.isArray(points) ? { contactPoints: points } : points,

  );



export const validateContactPersons = (persons) => {

  const list = Array.isArray(persons) ? persons : [];

  const filled = list.filter(

    (person) =>

      String(person.fullName || "").trim() ||

      (person.channels || []).some((ch) => String(ch.value || "").trim()),

  );



  for (const person of filled) {

    const fullName = String(person.fullName || "").trim();

    const channels = (person.channels || []).filter((ch) => String(ch.value || "").trim());



    if (!fullName) {

      return "Укажите имя контакта (ФИО или должность).";

    }



    if (channels.length === 0) {

      return `Контакт «${fullName}»: добавьте телефон, почту или другой канал.`;

    }



    for (const channel of channels) {

      const typeLabel = CONTACT_POINT_TYPE_LABELS[channel.type] || channel.type;

      const value = String(channel.value || "").trim();



      if (!value) {

        return `Контакт «${fullName}», «${typeLabel}»: укажите значение.`;

      }



      const valueError = validateClientContactPointValue(channel.type, value);

      if (valueError) {

        return `Контакт «${fullName}», «${typeLabel}»: ${valueError}`;

      }

    }

  }



  return null;

};



/** @deprecated используйте validateContactPersons */

export const validateContactPoints = (points) => validateContactPersons(normalizeContactPersonsForForm(points));



export const buildContactPersonsPayload = (persons) => {

  const list = Array.isArray(persons) ? persons : [];

  return list

    .map((person, personIndex) => ({

      fullName: String(person.fullName || "").trim(),

      role: String(person.role || "").trim() || null,

      sortOrder: personIndex,

      channels: (person.channels || [])

        .map((channel, channelIndex) => ({

          type: normalizeContactPointTypeForForm(channel.type),

          value: String(channel.value || "").trim(),

          sortOrder: channelIndex,

        }))

        .filter((channel) => channel.value !== ""),

    }))

    .filter((person) => person.fullName !== "" && person.channels.length > 0);

};



/** @deprecated используйте buildContactPersonsPayload */

export const buildContactPointsPayload = (points) => {

  const persons = normalizeContactPersonsForForm(points);

  return buildContactPersonsPayload(persons).flatMap((person) =>

    person.channels.map((channel) => ({

      type: channel.type,

      value: channel.value,

      contactName: person.fullName,

      sortOrder: channel.sortOrder,

    })),

  );

};



const digitsOnly = (value) => String(value || "").replace(/\D/g, "");



const toIntl375 = (raw) => {

  const d = digitsOnly(raw);

  if (d.startsWith("375")) {

    return d;

  }

  if (d.startsWith("80") && d.length >= 11) {

    return `375${d.slice(2)}`;

  }

  if (d.length === 9) {

    return `375${d}`;

  }

  return d;

};



const ensureHttps = (raw) => (raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);



const websiteHostname = (href) => {

  try {

    return new URL(href).hostname.replace(/^www\./i, "");

  } catch {

    return String(href).replace(/^https?:\/\//i, "").split("/")[0];

  }

};



/** Ссылка и подпись для отображения контакта на карточке клиента. */

export const formatContactPointLink = (type, value) => {

  const raw = String(value || "").trim();

  if (!raw) {

    return { href: null, label: "—", external: false };

  }



  const typeLabel = CONTACT_POINT_TYPE_LABELS[type] || type;



  switch (type) {

    case "email":

      return { href: `mailto:${raw}`, label: raw, external: false };

    case "mobile":

    case "phone":

    case "landline":

    case "fax": {

      const tel = raw.replace(/\s/g, "");

      return { href: `tel:${tel}`, label: raw, external: false };

    }

    case "viber": {

      const intl = toIntl375(raw);

      return { href: `viber://chat?number=%2B${intl}`, label: typeLabel, external: true };

    }

    case "whatsapp": {

      const intl = toIntl375(raw);

      return { href: `https://wa.me/${intl}`, label: typeLabel, external: true };

    }

    case "website": {

      const href = ensureHttps(raw);

      return { href, label: websiteHostname(href), external: true };

    }

    case "telegram": {

      if (/^https?:\/\//i.test(raw)) {

        return { href: raw, label: typeLabel, external: true };

      }

      const user = raw.replace(/^@/, "");

      return { href: `https://t.me/${user}`, label: typeLabel, external: true };

    }

    case "skype": {

      const login = raw.startsWith("live:") ? raw : `live:${raw}`;

      return { href: `skype:${login}?chat`, label: typeLabel, external: true };

    }

    case "instagram": {

      if (/^https?:\/\//i.test(raw)) {

        return { href: raw, label: typeLabel, external: true };

      }

      const user = raw.replace(/^@/, "");

      return { href: `https://instagram.com/${user}`, label: typeLabel, external: true };

    }

    case "vk": {

      const href = /^https?:\/\//i.test(raw) ? raw : ensureHttps(raw);

      return { href, label: typeLabel, external: true };

    }

    case "ok": {

      const href = /^https?:\/\//i.test(raw) ? raw : ensureHttps(raw);

      return { href, label: typeLabel, external: true };

    }

    case "linkedin": {

      const href = /^https?:\/\//i.test(raw) ? raw : ensureHttps(raw);

      return { href, label: typeLabel, external: true };

    }

    default:

      return { href: null, label: raw, external: false };

  }

};



export const getContactPointsSearchText = (clientOrPoints) => {

  const persons = Array.isArray(clientOrPoints?.contactPersons)

    ? clientOrPoints.contactPersons

    : null;

  const list = persons

    ? persons.flatMap((person) =>

        (person.channels || []).map((channel) => ({

          ...channel,

          contactName: person.fullName,

          personRole: person.role,

        })),

      )

    : Array.isArray(clientOrPoints)

      ? clientOrPoints

      : resolveContactPointsForDisplay(clientOrPoints);



  return list

    .flatMap((point) => [

      CONTACT_POINT_TYPE_LABELS[point.type] || point.type,

      point.value,

      point.contactName,

      point.personRole,

      formatContactPointLink(point.type, point.value).label,

    ])

    .join(" ");

};

