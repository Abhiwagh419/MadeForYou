export const PLACEHOLDER = "REPLACE_WITH_THE_ID_PRINTED_BY_wrangler_d1_create";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isDatabaseId = (v) => UUID.test(String(v ?? "").trim());

export function currentDatabaseId(toml) {
  return toml.match(/database_id\s*=\s*"([^"]*)"/)?.[1] ?? "";
}

export function pickDatabaseId(stdout, name) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  let list;
  try {
    list = JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
  const hit = list.find((d) => d && d.name === name);
  const id = hit?.uuid ?? hit?.database_id ?? hit?.id;
  return isDatabaseId(id) ? String(id).trim() : null;
}

export function applyDatabaseId(toml, id) {
  return toml.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${id}"`);
}
