/** Заголовок карточки сделки — название товара. */
export const getDealCardTitle = (deal) => {
  const product = String(deal?.productName ?? "").trim();
  if (product) {
    return product;
  }
  const title = String(deal?.title ?? "").trim();
  if (title) {
    return title;
  }
  return deal?.id != null ? `Сделка #${deal.id}` : "Сделка";
};

export const getDealProductName = (deal) => String(deal?.productName ?? "").trim() || "—";
