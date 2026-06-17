/** Сумма сделки в белорусских рублях (BYN), символ Br вместо ₽. */
export function formatDealAmount(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return String(value);
  }
  return new Intl.NumberFormat("be-BY", {
    style: "currency",
    currency: "BYN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(parsed);
}
