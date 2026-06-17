const BaseService = require("./baseService");
const prisma = require("../config/prisma");
const {
  CLIENT_CONTACT_POINT_TYPES,
  LEGACY_PHONE_TYPES,
} = require("../config/clientContactPointTypes");
const { validateClientContactPointValue } = require("../utils/contactValidators");
const { assertUserManagerId } = require("../utils/relationValidators");

const clientInclude = {
  contactPersons: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      channels: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  },
};

function flattenContactPoints(contactPersons) {
  return (contactPersons || []).flatMap((person) =>
    (person.channels || []).map((channel) => ({
      id: channel.id,
      type: channel.type,
      value: channel.value,
      contactName: person.fullName,
      personRole: person.role ?? null,
      sortOrder: channel.sortOrder,
      contactPersonId: person.id,
    })),
  );
}

function formatClient(row) {
  if (!row) {
    return row;
  }
  const { contactPersons, ...client } = row;
  const persons = (contactPersons || []).map((person) => ({
    id: person.id,
    fullName: person.fullName,
    role: person.role,
    sortOrder: person.sortOrder,
    channels: (person.channels || []).map((channel) => ({
      id: channel.id,
      type: channel.type,
      value: channel.value,
      sortOrder: channel.sortOrder,
    })),
  }));

  return {
    ...client,
    contactPersons: persons,
    contactPoints: flattenContactPoints(contactPersons || []),
  };
}

function normalizeChannel(raw, index) {
  const type = String(raw?.type || "").trim().toLowerCase();
  let value = raw?.value === undefined || raw?.value === null ? "" : String(raw.value).trim();
  if (type === "email" && value) {
    value = value.toLowerCase();
  }
  return {
    type,
    value,
    sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : index,
  };
}

function normalizeContactPoint(raw, index) {
  const type = String(raw?.type || "").trim().toLowerCase();
  let value = raw?.value === undefined || raw?.value === null ? "" : String(raw.value).trim();
  const contactName =
    raw?.contactName === undefined || raw?.contactName === null
      ? ""
      : String(raw.contactName).trim();
  if (type === "email" && value) {
    value = value.toLowerCase();
  }
  return {
    type,
    value,
    contactName,
    sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : index,
  };
}

function normalizeContactPerson(raw, index) {
  const fullName = String(raw?.fullName ?? raw?.full_name ?? "").trim();
  const roleRaw = raw?.role;
  const role =
    roleRaw === undefined || roleRaw === null || String(roleRaw).trim() === ""
      ? null
      : String(roleRaw).trim();
  const channels = (Array.isArray(raw?.channels) ? raw.channels : [])
    .map((channel, channelIndex) => normalizeChannel(channel, channelIndex))
    .filter((channel) => channel.value !== "");

  return {
    fullName,
    role,
    sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : index,
    channels,
  };
}

function groupFlatPointsToPersons(points) {
  const order = [];
  const map = new Map();

  for (const point of points) {
    const key = point.contactName || "Контакт";
    if (!map.has(key)) {
      map.set(key, {
        fullName: key,
        role: null,
        sortOrder: order.length,
        channels: [],
      });
      order.push(key);
    }
    const person = map.get(key);
    if (point.value) {
      person.channels.push({
        type: point.type,
        value: point.value,
        sortOrder: person.channels.length,
      });
    }
  }

  return order.map((key) => map.get(key));
}

function extractContactData(payload) {
  const data = { ...payload };
  const hasContactPersons = Object.prototype.hasOwnProperty.call(data, "contactPersons");
  const hasContactPoints = Object.prototype.hasOwnProperty.call(data, "contactPoints");
  delete data.contactPersons;
  delete data.contactPoints;

  if (hasContactPersons) {
    const raw = payload.contactPersons;
    const list = Array.isArray(raw) ? raw : [];
    const contactPersons = list
      .map((item, index) => normalizeContactPerson(item, index))
      .filter((person) => person.fullName !== "" || person.channels.length > 0);
    return { data, contactPersons, hasContacts: true };
  }

  if (hasContactPoints) {
    const raw = payload.contactPoints;
    const list = Array.isArray(raw) ? raw : [];
    const points = list
      .map((item, index) => normalizeContactPoint(item, index))
      .filter((item) => item.value !== "" || item.contactName !== "");
    return {
      data,
      contactPersons: groupFlatPointsToPersons(points),
      hasContacts: true,
    };
  }

  const legacyPoints = [];
  if (data.phone !== undefined && data.phone !== null && String(data.phone).trim() !== "") {
    legacyPoints.push({
      type: "phone",
      value: String(data.phone).trim(),
      contactName: "Основной контакт",
      sortOrder: legacyPoints.length,
    });
  }
  if (data.email !== undefined && data.email !== null && String(data.email).trim() !== "") {
    legacyPoints.push({
      type: "email",
      value: String(data.email).trim().toLowerCase(),
      contactName: "Основной контакт",
      sortOrder: legacyPoints.length,
    });
  }

  const hasLegacy = legacyPoints.length > 0;
  delete data.phone;
  delete data.email;

  return {
    data,
    contactPersons: groupFlatPointsToPersons(legacyPoints),
    hasContacts: hasLegacy,
  };
}

function deriveLegacyColumns(contactPersons) {
  const flat = flattenContactPoints(
    (contactPersons || []).map((person, index) => ({
      ...person,
      id: index,
      channels: person.channels || [],
    })),
  );
  const firstPhone = flat.find((point) => LEGACY_PHONE_TYPES.has(point.type));
  const firstEmail = flat.find((point) => point.type === "email");
  return {
    phone: firstPhone?.value || null,
    email: firstEmail?.value || null,
  };
}

class ClientService extends BaseService {
  normalizePayload(payload, auth) {
    const { data } = extractContactData(payload);
    return super.normalizePayload(data, auth);
  }

  validateContactPersons(contactPersons) {
    for (const person of contactPersons) {
      if (!person.fullName) {
        const err = new Error("Для каждого контакта укажите имя (ФИО или должность).");
        err.statusCode = 400;
        throw err;
      }

      if (!person.channels.length) {
        const err = new Error(
          `У контакта «${person.fullName}» добавьте хотя бы один телефон, почту или другой канал.`,
        );
        err.statusCode = 400;
        throw err;
      }

      for (const channel of person.channels) {
        if (!CLIENT_CONTACT_POINT_TYPES.includes(channel.type)) {
          const err = new Error(`Недопустимый тип контакта: ${channel.type || "(пусто)"}.`);
          err.statusCode = 400;
          throw err;
        }

        if (!channel.value) {
          const err = new Error(
            `Контакт «${person.fullName}»: укажите значение для канала связи.`,
          );
          err.statusCode = 400;
          throw err;
        }

        const valueError = validateClientContactPointValue(channel.type, channel.value);
        if (valueError) {
          const err = new Error(`Контакт «${person.fullName}»: ${valueError}`);
          err.statusCode = 400;
          throw err;
        }
      }
    }
  }

  async syncContactPersons(clientId, contactPersons) {
    await prisma.clientContactPoint.deleteMany({ where: { clientId } });
    await prisma.clientContactPerson.deleteMany({ where: { clientId } });

    for (const [personIndex, person] of contactPersons.entries()) {
      await prisma.clientContactPerson.create({
        data: {
          clientId,
          fullName: person.fullName,
          role: person.role,
          sortOrder: Number.isFinite(person.sortOrder) ? person.sortOrder : personIndex,
          channels: {
            create: person.channels.map((channel, channelIndex) => ({
              clientId,
              type: channel.type,
              value: channel.value,
              contactName: person.fullName,
              sortOrder: Number.isFinite(channel.sortOrder) ? channel.sortOrder : channelIndex,
            })),
          },
        },
      });
    }
  }

  async list(auth) {
    const scope = this.buildScope(auth);
    const rows = await prisma.client.findMany({
      where: scope,
      orderBy: { id: "asc" },
      include: clientInclude,
    });
    return rows.map(formatClient);
  }

  async get(id, auth) {
    const entity = await prisma.client.findUnique({
      where: { id },
      include: clientInclude,
    });
    if (!entity) {
      return null;
    }

    const scope = this.buildScope(auth);
    if (
      scope[this.config.managerScopeField] &&
      entity[this.config.managerScopeField] !== scope[this.config.managerScopeField]
    ) {
      return null;
    }

    return formatClient(entity);
  }

  async create(payload, auth) {
    const { data, contactPersons, hasContacts } = extractContactData(payload);
    const normalized = super.normalizePayload(data, auth);
    if (hasContacts) {
      this.validateContactPersons(contactPersons);
    }

    await assertUserManagerId(normalized.managerId);

    const legacy = deriveLegacyColumns(contactPersons);
    const created = await this.repository.create({
      ...normalized,
      ...legacy,
    });

    if (hasContacts) {
      await this.syncContactPersons(created.id, contactPersons);
    }

    return this.get(created.id, auth);
  }

  async update(id, payload, auth) {
    const current = await this.get(id, auth);
    if (!current) {
      return null;
    }

    const { data, contactPersons, hasContacts } = extractContactData(payload);
    const normalized = super.normalizePayload(data, auth);
    if (hasContacts) {
      this.validateContactPersons(contactPersons);
    }

    const updateData = { ...normalized };
    if (hasContacts) {
      Object.assign(updateData, deriveLegacyColumns(contactPersons));
    }

    if (updateData.managerId !== undefined) {
      await assertUserManagerId(updateData.managerId);
    }

    await this.repository.update(id, updateData);
    if (hasContacts) {
      await this.syncContactPersons(id, contactPersons);
    }

    return this.get(id, auth);
  }
}

module.exports = ClientService;
