/** Название компании (поле name в API). */

export const getClientCompanyName = (client) => String(client?.name ?? "").trim() || "—";



/** Заголовок карточки клиента — название компании. */

export const getClientCardTitle = (client) => {

  const company = getClientCompanyName(client);

  return company === "—" ? "Клиент" : company;

};



/** Подпись в списках и FK — название компании. */

export const formatClientRef = (id, clientsById) => {

  if (id === null || id === undefined || id === "") {

    return "—";

  }

  let client = clientsById?.[id];

  if (!client) {

    const n = Number.parseInt(String(id), 10);

    if (Number.isFinite(n)) {

      client = clientsById?.[n];

    }

  }

  return client ? formatClientOptionLabel(client) : `ID ${id}`;

};



export const formatClientOptionLabel = (client) => {

  const company = getClientCompanyName(client);

  if (company !== "—") {

    return company;

  }

  return client?.id != null ? `#${client.id}` : "Клиент";

};

