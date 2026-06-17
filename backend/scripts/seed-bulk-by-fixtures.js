/**
 * Осмысленные тестовые данные для CRM (Беларусь): города, компании, задачи, фильтры.
 */

const SEED_EMAIL_DOMAIN = "demo.crm.by";

/** В заметках клиентов — для поиска демо-записей после вставки. */
const CLIENT_NOTES_TAG = "сектор:";

/** В описании задач — для фильтров и идентификации демо-задач. */
const TASK_DESC_TAG = "категория:";

/** В описании сделок — город для фильтров и связи с клиентом. */
const DEAL_DESC_CITY_PREFIX = "город:";

const CYR_TO_LAT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function latinSlug(text) {
  const raw = String(text)
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => CYR_TO_LAT[ch] ?? (ch >= "a" && ch <= "z" ? ch : ""))
    .join("");
  const cleaned = raw.replace(/[^a-z]+/g, "");
  return cleaned || "user";
}

const SECTOR_EMAIL_DOMAINS = {
  IT: "belsoft.by",
  trade: "opttorg.by",
  agro: "agrokomplekt.by",
  build: "stroinvest.by",
  logistics: "transline.by",
  finance: "finservice.by",
  medic: "medtech.by",
  edu: "edupro.by",
};

/** Подсказки для ручной проверки фильтров в UI */
const FILTER_HINTS = [
  "=== Проверка фильтров (Беларусь) ===",
  "Клиенты → Поле «Адрес», значение: Минск | Гомель | Брест | Витебск",
  "Клиенты → Поле «Название компании», значение: ООО | ЧТУП | сектор",
  "Сделки → Карточка: «Предмет сделки» (productName); название сделки — компания в title",
  "Сделки → Поле «Предмет сделки», значение: лицензия | оборудование | консалтинг",
  "Клиенты → Поле «Заметки», значение: VIP | IT | торговля | просрочка",
  "Клиенты → Поле «Все поля», значение: +37529 | .by | Telegram | VIP",
  "Задачи → Статус: new | in_progress | blocked | done",
  "Задачи → Приоритет: urgent | high (ищите «срочно» в названии)",
  "Задачи → Название: BYN | НДС | договор | акт сверки | просрочка",
  "Звонки → Статус: missed | failed | completed; Направление: in | out",
  "Звонки → Поле clientId + значение ID клиента из карточки",
  "Документы → filename: dogovor | schet | akt | nds",
  "Сделки → Этап: negotiation | won; Сумма в BYN",
];

const LEGAL_FORMS = ["ООО", "ЧТУП", "УП", "СЗАО", "ОДО", "ИП"];

const SECTORS = [
  { code: "IT", label: "IT и разработка", stem: "БелСофт" },
  { code: "trade", label: "торговля", stem: "ОптТорг" },
  { code: "agro", label: "агро", stem: "АгроКомплект" },
  { code: "build", label: "строительство", stem: "СтройИнвест" },
  { code: "logistics", label: "логистика", stem: "ТрансЛайн" },
  { code: "finance", label: "финансы", stem: "ФинСервис" },
  { code: "medic", label: "медицина", stem: "МедТех" },
  { code: "edu", label: "образование", stem: "ЭдуПро" },
];

const CITIES = [
  { name: "Минск", phonePrefix: "17", streets: ["пр-т Независимости", "ул. Сурганова", "пр-т Победителей", "ул. Кальварийская"] },
  { name: "Гомель", phonePrefix: "232", streets: ["ул. Советская", "пр-т Ленина", "ул. Рогачёвская"] },
  { name: "Брест", phonePrefix: "162", streets: ["ул. Московская", "пр-т Машерова", "ул. Гоголя"] },
  { name: "Витебск", phonePrefix: "212", streets: ["ул. Замковая", "пр-т Фрунзе", "ул. Терешковой"] },
  { name: "Гродно", phonePrefix: "152", streets: ["ул. Ожешко", "пр-т Янки Купалы", "ул. Победы"] },
  { name: "Могилёв", phonePrefix: "222", streets: ["пр-т Пушкинский", "ул. Первомайская", "ул. Славгородская"] },
];

const MANAGER_FIRST = [
  "Александр", "Дмитрий", "Максим", "Андрей", "Иван", "Сергей", "Николай", "Павел", "Владимир", "Артём",
  "Елена", "Ольга", "Наталья", "Татьяна", "Мария", "Анна", "Ирина", "Светлана", "Юлия", "Екатерина",
];

const MANAGER_LAST = [
  "Ковальчук", "Мельник", "Шевченко", "Бондаренко", "Кравченко", "Тарасевич", "Жук", "Савицкий", "Лукашенко", "Петров",
  "Иванова", "Сидорова", "Козлова", "Новикова", "Морозова", "Волкова", "Соколова", "Лебедева", "Кузнецова", "Попова",
];

const CLIENT_FIRST = [
  "Игорь", "Виктор", "Олег", "Роман", "Кирилл", "Галина", "Людмила", "Вера", "Нина", "Зоя",
  "Станислав", "Борис", "Геннадий", "Валентина", "Лариса", "Тамара", "Раиса", "Фёдор", "Григорий", "Пётр",
];

const CLIENT_LAST = [
  "Воронов", "Громов", "Дрозд", "Ермак", "Зайцев", "Ильин", "Киселёв", "Лазарев", "Макаров", "Носов",
  "Орлов", "Панов", "Рыбаков", "Семёнов", "Тихонов", "Уваров", "Фролов", "Харитонов", "Цветков", "Шаров",
];

const PRODUCT_NAMES = [
  "Серверное оборудование",
  "Лицензия на ПО",
  "Комплектующие для производства",
  "Строительные материалы",
  "Сельхозтехника",
  "Медицинские расходники",
  "Канцелярия и офис",
  "Логистические услуги",
  "Консалтинг",
  "Оборудование для склада",
];

const CONTACT_ROLES = [
  "Директор",
  "Бухгалтер",
  "Менеджер по закупкам",
  "Юрист",
  "Главный инженер",
  "Секретарь",
  "Основной контакт",
];

const TASK_TEMPLATES = [
  { title: "Выставить счёт на оплату в BYN", tag: "BYN" },
  { title: "Согласовать договор поставки с юристом", tag: "договор" },
  { title: "Подготовить акт сверки за квартал", tag: "акт сверки" },
  { title: "Уточнить ставку НДС 20% в спецификации", tag: "НДС" },
  { title: "Просрочка: перезвонить по заявке", tag: "просрочка" },
  { title: "Срочно: подписать допсоглашение", tag: "срочно" },
  { title: "Отправить коммерческое предложение на email", tag: "email" },
  { title: "Проверить УНП контрагента в реестре", tag: "УНП" },
  { title: "Запросить ТТН на отгрузку со склада", tag: "ТТН" },
  { title: "Согласовать цену в белорусских рублях", tag: "BYN" },
  { title: "Напомнить об оплате по договору", tag: "договор" },
  { title: "Заблокировано: ждём подпись ЭЦП", tag: "ЭЦП" },
];

const DEAL_TITLES = [
  "Поставка оборудования",
  "Договор на сервисное обслуживание",
  "Закупка комплектующих",
  "Лицензия на ПО на год",
  "Поставка расходных материалов",
];

const DOC_NAME_PARTS = ["dogovor", "schet", "akt", "specifikaciya", "dop_soglashenie", "nds", "ttn", "kp"];

const TASK_STATUSES = ["new", "in_progress", "blocked", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];
const DEAL_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const CALL_STATUSES = ["completed", "missed", "failed"];

function pick(arr, index) {
  return arr[Math.abs(index) % arr.length];
}

/** Мобильный +37529 / +37533 / +37544 */
function belarusMobile(seed) {
  const codes = ["29", "33", "44"];
  const code = pick(codes, seed);
  const n = String(Math.abs(seed) % 10_000_000).padStart(7, "0");
  return `+375${code}${n}`;
}

/** Городской: +37517 (Минск), +375232 (Гомель) и т.д. */
function belarusLandline(city, seed) {
  const prefix = city.phonePrefix;
  const local = String(Math.abs(seed) % 1_000_000).padStart(7, "0").slice(-7);
  if (prefix.length === 2) {
    return `+375${prefix}${local}`;
  }
  return `+375${prefix}${local.slice(-6)}`;
}

function buildManagerProfile(index) {
  const first = pick(MANAGER_FIRST, index);
  const last = pick(MANAGER_LAST, index + 17);
  const emailLocal = `${latinSlug(first)}.${latinSlug(last)}`;
  return {
    fullName: `${first} ${last}`,
    email: `${emailLocal}@${SEED_EMAIL_DOMAIN}`,
    phone: belarusMobile(30_000 + index),
  };
}

function buildAdminProfile(index) {
  const names = [
    { fullName: "Администратор CRM", email: `admin@${SEED_EMAIL_DOMAIN}` },
    { fullName: "Зам. администратора", email: `zam.admin@${SEED_EMAIL_DOMAIN}` },
  ];
  const row = names[index - 1] || names[0];
  return { ...row, phone: belarusLandline(CITIES[0], 9000 + index) };
}

function buildClientProfile(globalIdx, managerIdx) {
  const city = pick(CITIES, globalIdx);
  const sector = pick(SECTORS, globalIdx + managerIdx);
  const legal = pick(LEGAL_FORMS, globalIdx);
  const stem = sector.stem;
  const company = `${legal} «${stem}»`;
  const productName = pick(PRODUCT_NAMES, globalIdx);
  const street = pick(city.streets, globalIdx);
  const building = 1 + (globalIdx % 120);
  const address = `г. ${city.name}, ${street}, ${building}`;
  const first = pick(CLIENT_FIRST, globalIdx);
  const last = pick(CLIENT_LAST, globalIdx + 3);
  const contactName = `${first} ${last}`;
  const emailDomain = SECTOR_EMAIL_DOMAINS[sector.code] || "company.by";
  const email = `${first.toLowerCase()}.${last.toLowerCase()}@${emailDomain}`;
  const mobile = belarusMobile(1_000_000 + globalIdx);
  const landline = belarusLandline(city, 2_000_000 + globalIdx);
  const isVip = globalIdx % 17 === 0;
  const hasOverdue = globalIdx % 23 === 0;
  const notes = [
    `${CLIENT_NOTES_TAG}${sector.code}`,
    sector.label,
    `город:${city.name}`,
    "УНП в реестре",
    isVip ? "VIP" : null,
    hasOverdue ? "просрочка" : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    name: company,
    productName,
    contactName,
    company,
    dealProductName: productName,
    phone: mobile,
    email,
    address,
    notes,
    city,
    sector,
    mobile,
    landline,
    emailContact: email,
    isVip,
  };
}

function buildContactPersonsForClient(profile, globalIdx) {
  const domain = SECTOR_EMAIL_DOMAINS[profile.sector.code] || "company.by";
  const persons = [
    {
      fullName: profile.contactName,
      role: pick(CONTACT_ROLES, globalIdx),
      sortOrder: 0,
      channels: [
        { type: "phone", value: profile.mobile, sortOrder: 0 },
        { type: "email", value: profile.emailContact, sortOrder: 1 },
      ],
    },
  ];

  if (globalIdx % 3 === 0) {
    persons.push({
      fullName: "Приёмная",
      role: null,
      sortOrder: persons.length,
      channels: [{ type: "phone", value: profile.landline, sortOrder: 0 }],
    });
  }
  if (globalIdx % 4 === 0) {
    persons.push({
      fullName: "Секретарь",
      role: "Офис",
      sortOrder: persons.length,
      channels: [
        {
          type: "telegram",
          value: `@${latinSlug(profile.sector.stem)}`,
          sortOrder: 0,
        },
      ],
    });
  }
  if (globalIdx % 5 === 0) {
    persons.push({
      fullName: profile.company.replace(/[«»]/g, ""),
      role: "Сайт компании",
      sortOrder: persons.length,
      channels: [{ type: "website", value: `https://www.${domain}`, sortOrder: 0 }],
    });
  }
  if (globalIdx % 7 === 0) {
    persons.push({
      fullName: "Бухгалтерия",
      role: null,
      sortOrder: persons.length,
      channels: [{ type: "viber", value: profile.mobile, sortOrder: 0 }],
    });
  }
  if (globalIdx % 11 === 0) {
    persons.push({
      fullName: "Маркетинг",
      role: null,
      sortOrder: persons.length,
      channels: [
        {
          type: "vk",
          value: `vk.com/${latinSlug(profile.sector.stem)}`,
          sortOrder: 0,
        },
      ],
    });
  }
  return persons;
}

function taskStatusForIndex(t) {
  const bucket = t % 20;
  if (bucket < 4) return "new";
  if (bucket < 9) return "in_progress";
  if (bucket < 12) return "blocked";
  return "done";
}

function taskPriorityForIndex(t) {
  const bucket = t % 10;
  if (bucket < 2) return "urgent";
  if (bucket < 4) return "high";
  if (bucket < 7) return "medium";
  return "low";
}

function taskDueDateForIndex(t, now) {
  const bucket = t % 10;
  const dayMs = 86400000;
  if (bucket < 2) return new Date(now.getTime() - (3 + (t % 14)) * dayMs);
  if (bucket < 3) return new Date(now.getTime());
  if (bucket < 7) return new Date(now.getTime() + (1 + (t % 6)) * dayMs);
  return new Date(now.getTime() + (14 + (t % 45)) * dayMs);
}

function buildTaskRow(t, manager, clientId, dealId, now) {
  const tpl = pick(TASK_TEMPLATES, t);
  const status = taskStatusForIndex(t);
  const priority = taskPriorityForIndex(t);
  return {
    title: tpl.title,
    description: `${TASK_DESC_TAG} ${tpl.tag}`.trim(),
    status,
    priority,
    dueDate: taskDueDateForIndex(t, now),
    authorId: manager.id,
    clientId,
    dealId,
  };
}

function buildDealRow(globalIdx, clientId, managerId, profile, now) {
  const dealKind = pick(DEAL_TITLES, globalIdx);
  const company = profile.name || profile.company;
  const title = `${dealKind} — ${company}`;
  const productName = profile.dealProductName || profile.productName;
  const stage = pick(DEAL_STAGES, globalIdx + 2);
  const amount = (2500 + (globalIdx % 180) * 1750).toFixed(2);
  const closingDays = (globalIdx % 90) - 15;
  const closing = new Date(now.getTime() + closingDays * 86400000);
  return {
    title,
    productName,
    description: `${profile.sector.label} | ${DEAL_DESC_CITY_PREFIX} ${profile.city.name} | BYN`,
    amount,
    stage,
    closingDate: closing,
    clientId,
    managerId,
  };
}

function callStatusForIndex(k) {
  const b = k % 10;
  if (b < 6) return "completed";
  if (b < 8) return "missed";
  return "failed";
}

function syntheticDocFilename(profile, k, globalIdx) {
  const part = pick(DOC_NAME_PARTS, globalIdx + k);
  const stem = latinSlug(profile?.sector?.stem || "doc");
  return `${part}_${stem}.pdf`;
}

function printFilterHints() {
  console.log("");
  for (const line of FILTER_HINTS) {
    console.log(line);
  }
  console.log("");
}

module.exports = {
  SEED_EMAIL_DOMAIN,
  CLIENT_NOTES_TAG,
  TASK_DESC_TAG,
  DEAL_DESC_CITY_PREFIX,
  FILTER_HINTS,
  buildAdminProfile,
  buildManagerProfile,
  buildClientProfile,
  buildContactPersonsForClient,
  buildContactPointsForClient: buildContactPersonsForClient,
  buildTaskRow,
  buildDealRow,
  taskStatusForIndex,
  taskPriorityForIndex,
  callStatusForIndex,
  syntheticDocFilename,
  belarusMobile,
  printFilterHints,
  DEAL_STAGES,
  TASK_STATUSES,
};
