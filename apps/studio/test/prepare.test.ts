import { describe, expect, it } from "vitest";
import { PLACEHOLDER, applyDatabaseId, currentDatabaseId, isDatabaseId, pickDatabaseId } from "../scripts/dbid.mjs";

const ID = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const TOML = `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "madeforyou"\ndatabase_id = "${PLACEHOLDER}"\n`;

describe("database id helper", () => {
  it("knows what a real id looks like, and that the placeholder is not one", () => {
    expect(isDatabaseId(ID)).toBe(true);
    expect(isDatabaseId(PLACEHOLDER)).toBe(false);
    expect(isDatabaseId("")).toBe(false);
    expect(isDatabaseId(undefined)).toBe(false);
  });
  it("finds the id for the right database in wrangler's output, even with log lines around it", () => {
    const out = ` ⛅️ wrangler 4.1\n[\n  {"uuid":"aaaaaaaa-5e6f-4a8b-9c0d-1e2f3a4b5c6d","name":"other"},\n  {"uuid":"${ID}","name":"madeforyou"}\n]\n`;
    expect(pickDatabaseId(out, "madeforyou")).toBe(ID);
    expect(pickDatabaseId(out, "missing")).toBeNull();
    expect(pickDatabaseId("not json", "madeforyou")).toBeNull();
    expect(pickDatabaseId("[]", "madeforyou")).toBeNull();
  });
  it("writes the id into the config and leaves the rest alone", () => {
    const next = applyDatabaseId(TOML, ID);
    expect(currentDatabaseId(next)).toBe(ID);
    expect(next).toContain('binding = "DB"');
    expect(currentDatabaseId(TOML)).toBe(PLACEHOLDER);
  });
});
