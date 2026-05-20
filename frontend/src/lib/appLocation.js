/**
 * Аргумент для React Router `Navigate` / `navigate`: pathname + search отдельно,
 * чтобы длинный query не терялся при разборе строки `to`.
 */
export function toAppLocation(pathWithQuery) {
  if (pathWithQuery == null || pathWithQuery === "" || pathWithQuery === "/") {
    return "/";
  }
  const q = pathWithQuery.indexOf("?");
  if (q === -1) {
    return pathWithQuery;
  }
  const pathname = pathWithQuery.slice(0, q) || "/";
  const search = pathWithQuery.slice(q);
  return { pathname, search };
}
