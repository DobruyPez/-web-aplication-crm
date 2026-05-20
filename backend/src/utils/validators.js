const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const validatePayload = (payload, requiredFields = []) => {
  if (!isObject(payload)) {
    return "Body must be a JSON object.";
  }

  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      return `Field "${field}" is required.`;
    }
  }

  return null;
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

module.exports = {
  validatePayload,
  parsePositiveInt,
};
