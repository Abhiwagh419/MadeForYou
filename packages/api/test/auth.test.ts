import { describe, expect, it } from "vitest";
import { SignJWT, generateKeyPair } from "jose";
import { clerkIssuer, clerkJwksUrl } from "../src";
import { makeClient, makeEnv, makeJwtSetup } from "../src/testing";

describe("sign-in settings tolerate common paste mistakes", () => {
  const url = "https://good-name-12.clerk.accounts.dev";
  it.each([
    ["clean", url],
    ["trailing slash", `${url}/`],
    ["trailing newline", `${url}\r\n`],
    ["leading space", `  ${url}`],
    ["the JWKS address pasted as the issuer", `${url}/.well-known/jwks.json`],
  ])("issuer: %s", (_n, value) => {
    expect(clerkIssuer({ CLERK_ISSUER: value })).toBe(url);
  });
  it("derives each address from the other when only one is set", () => {
    expect(clerkJwksUrl({ CLERK_ISSUER: url })).toBe(`${url}/.well-known/jwks.json`);
    expect(clerkIssuer({ CLERK_JWKS_URL: `${url}/.well-known/jwks.json` })).toBe(url);
    expect(clerkJwksUrl({ CLERK_JWKS_URL: `${url}\n` })).toBe(`${url}/.well-known/jwks.json`);
    expect(clerkJwksUrl({})).toBe("");
  });
});

describe("/api/diag explains a rejected login", () => {
  const diag = async (env: ReturnType<typeof makeEnv>, token?: string, deps = {}) => {
    const call = makeClient(env, deps);
    return (await call("GET", "/diag", { headers: token ? { authorization: `Bearer ${token}` } : {} })).json;
  };
  it("says so when the server has no sign-in settings", async () => {
    const d = await diag(makeEnv({ ALLOW_DEV_AUTH: "0" }));
    expect(d.serverConfigured).toBe(false);
    expect(d.problem).toMatch(/no sign-in settings/);
    expect(d.problem).toMatch(/deploy again/);
  });
  it("says so when the browser sent no token", async () => {
    const d = await diag(makeEnv({ CLERK_ISSUER: "https://clerk.test" }));
    expect(d.hasToken).toBe(false);
    expect(d.problem).toMatch(/did not send/);
  });
  it("names both addresses when the token comes from a different Clerk application", async () => {
    const jwt = await makeJwtSetup();
    const token = await jwt.sign("user_1", { iss: "https://other-app-99.clerk.accounts.dev" });
    const d = await diag(makeEnv({ CLERK_ISSUER: "https://my-app-1.clerk.accounts.dev" }), token, { verify: jwt.verify });
    expect(d.ok).toBe(false);
    expect(d.problem).toContain("other-app-99");
    expect(d.problem).toContain("my-app-1");
  });
  it("reports success for a good token, and never reveals secrets", async () => {
    const jwt = await makeJwtSetup();
    const token = await jwt.sign("user_1");
    const env = makeEnv({ CLERK_ISSUER: "https://clerk.test/" });
    const d = await diag(env, token, { verify: jwt.verify });
    expect(d.ok).toBe(true);
    expect(d.configuredIssuer).toBe("https://clerk.test");
    expect(JSON.stringify(d)).not.toContain(env.SESSION_SECRET);
  });
  it("explains an expired or unparsable token", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    const expired = await new SignJWT({}).setProtectedHeader({ alg: "RS256" }).setSubject("u").setIssuer("https://clerk.test").setExpirationTime("1s").sign(privateKey);
    const env = makeEnv({ CLERK_ISSUER: "https://clerk.test" });
    const bad = await diag(env, "not-a-token");
    expect(bad.problem).toMatch(/not a valid token/);
    const d = await diag(env, expired, { verify: async () => { throw Object.assign(new Error("exp"), { code: "ERR_JWT_EXPIRED" }); } });
    expect(d.problem).toMatch(/expired/);
  });
});

describe("/api/diag and test logins", () => {
  it("accepts a test login only while the server allows them", async () => {
    const on = makeClient(makeEnv({ ALLOW_DEV_AUTH: "1" }));
    expect((await on("GET", "/diag", { headers: { authorization: "Bearer dev:abhi" } })).json.ok).toBe(true);
    const off = makeClient(makeEnv({ ALLOW_DEV_AUTH: "0" }));
    const d = (await off("GET", "/diag", { headers: { authorization: "Bearer dev:abhi" } })).json;
    expect(d.ok).toBe(false);
    expect(d.problem).toMatch(/switched off/);
  });
});
