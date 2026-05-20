/**
 * Удаляет сгенерированный кэш Prisma в node_modules/.prisma перед `prisma generate`.
 * На Windows помогает при EPERM: не удаётся переименовать query_engine-windows.dll.node (файл занят процессом node).
 */
const fs = require("fs");
const path = require("path");

const dotPrisma = path.join(__dirname, "..", "node_modules", ".prisma");

const removeRecursive = (targetPath) => {
  fs.rmSync(targetPath, { recursive: true, force: true });
};

try {
  removeRecursive(dotPrisma);
  console.log("Removed:", dotPrisma);
} catch (err) {
  if (err.code === "ENOENT") {
    return;
  }
  console.error("");
  console.error("Не удалось удалить кэш Prisma:", err.message);
  console.error("");
  console.error("На Windows это почти всегда значит: файл query_engine-windows.dll.node занят процессом.");
  console.error("Сделайте по шагам:");
  console.error("  1) Остановите backend (Ctrl+C во всех терминалах с npm run dev / nodemon).");
  console.error("  2) Закройте лишние окна Cursor/VS Code или перезапустите IDE (иногда держит DLL).");
  console.error("  3) В «Диспетчере задач» завершите все процессы «Node.js JavaScript Runtime».");
  console.error("  4) Снова: npm run prisma:generate:clean (из корня репозитория) или из backend.");
  console.error("  5) Если не помогает — добавьте папку проекта в исключения антивируса или выполните generate после перезагрузки ПК.");
  console.error("");
  process.exit(1);
}
