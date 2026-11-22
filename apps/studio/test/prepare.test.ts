import { describe, expect, it } from "vitest";
import { liveModeConfigured } from "../scripts/liveMode.mjs";
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

describe("live-mode guard for deploys", () => {
  it("accepts VITE_REMOTE=1 from the .env file or from the environment", () => {
    expect(liveModeConfigured(["VITE_CLERK_PUBLISHABLE_KEY=pk_x\nVITE_REMOTE=1\n"], {})).toBe(true);
    expect(liveModeConfigured(['  VITE_REMOTE = "1"  # on'], {})).toBe(true);
    expect(liveModeConfigured([], { VITE_REMOTE: "1" })).toBe(true);
  });
  it("refuses a build that would not be connected to the server", () => {
    expect(liveModeConfigured([], {})).toBe(false);
    expect(liveModeConfigured(["VITE_CLERK_PUBLISHABLE_KEY=pk_x"], {})).toBe(false);
    expect(liveModeConfigured(["VITE_REMOTE=0"], {})).toBe(false);
    expect(liveModeConfigured(["# VITE_REMOTE=1"], {})).toBe(false);
    expect(liveModeConfigured(["VITE_REMOTE=10"], {})).toBe(false);
    expect(liveModeConfigured(["NOT_VITE_REMOTE=1"], {})).toBe(false);
    expect(liveModeConfigured(undefined as never, { VITE_REMOTE: "0" })).toBe(false);
  });
});
