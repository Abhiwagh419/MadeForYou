// Runs before every deploy. It makes sure wrangler.toml exists and contains YOUR database id,
// so you never have to copy the id by hand and a new download of the code cannot erase it.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { applyDatabaseId, currentDatabaseId, isDatabaseId, pickDatabaseId } from "./dbid.mjs";

const DB_NAME = "madeforyou";

if (!existsSync("wrangler.toml")) {
  copyFileSync("wrangler.example.toml", "wrangler.toml");
  console.log("Created wrangler.toml from wrangler.example.toml");
}
const toml = readFileSync("wrangler.toml", "utf8");
if (isDatabaseId(currentDatabaseId(toml))) {
  console.log("Database id is set.");
  process.exit(0);
}

console.log(`wrangler.toml has no database id yet. Looking up "${DB_NAME}" in your Cloudflare account...`);
const r = spawnSync("pnpm", ["exec", "wrangler", "d1", "list", "--json"], { encoding: "utf8", shell: true });
const id = pickDatabaseId(r.stdout ?? "", DB_NAME);
if (!id) {
  console.error(`
Could not find a database named "${DB_NAME}".
  1. Make sure you are logged in:      pnpm exec wrangler login
  2. If you never created it, create:   pnpm exec wrangler d1 create ${DB_NAME}
  3. Then run this deploy command again.
${(r.stderr ?? "").trim().slice(0, 400)}`);
  process.exit(1);
}
writeFileSync("wrangler.toml", applyDatabaseId(toml, id));
console.log(`Found it. Saved database id ${id} into wrangler.toml`);
