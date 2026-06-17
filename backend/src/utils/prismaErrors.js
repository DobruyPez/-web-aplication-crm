/**
 * Понятные сообщения для ошибок Prisma (FK, уникальность, рассинхрон схемы БД).
 */
function formatPrismaError(err) {
  if (!err || typeof err !== "object") {
    return null;
  }

  const message = String(err.message || "");

  if (message.includes("does not exist in the current database")) {
    if (message.includes("clients.product_name")) {
      return "В таблице clients нет product_name (поле перенесено на deals). Выполните migrate_product_name_to_deals_pgadmin.sql и npx prisma generate.";
    }
    if (message.includes("deals.product_name")) {
      return "В таблице deals нет product_name. Выполните migrate_product_name_to_deals_pgadmin.sql и npx prisma generate.";
    }
    return "Схема БД не совпадает с приложением. Выполните SQL-миграции из backend/prisma/sql/ и перезапустите сервер.";
  }

  if (err.code === "P2003") {
    const field = String(err.meta?.field_name || "");
    if (field.includes("manager_id")) {
      return "Указанный менеджер не найден. Выберите менеджера из списка.";
    }
    if (field.includes("client_id")) {
      return "Указанный клиент не найден.";
    }
    if (field.includes("contact_person_id")) {
      return "Ошибка связи контактного лица с клиентом.";
    }
    return "Связанная запись не найдена. Проверьте менеджера, клиента и другие связи.";
  }

  if (err.code === "P2002") {
    return "Запись с такими данными уже существует.";
  }

  if (err.code === "P2025") {
    return "Запись не найдена.";
  }

  return null;
}

module.exports = { formatPrismaError };
