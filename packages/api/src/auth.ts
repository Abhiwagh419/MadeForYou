import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import type { Deps, Env } from "./types";

const JWKS_SUFFIX = "/.well-known/jwks.json";

/**
 * Secrets pasted into a terminal often carry a stray space, newline, trailing slash, or the
 * wrong one of the two Clerk addresses. Accept all of those instead of failing silently.
 */
export function clerkIssuer(env: Pick<Env, "CLERK_ISSUER" | "CLERK_JWKS_URL">): string {
  const clean = (v?: string) => (v ?? "").trim().replace(/\/\.well-known\/jwks\.json$/, "").replace(/\/+$/, "");
  return clean(env.CLERK_ISSUER) || clean(env.CLERK_JWKS_URL);
}
export function clerkJwksUrl(env: Pick<Env, "CLERK_ISSUER" | "CLERK_JWKS_URL">): string {
  const explicit = (env.CLERK_JWKS_URL ?? "").trim();
  if (explicit) return explicit.endsWith(JWKS_SUFFIX) ? explicit : `${explicit.replace(/\/+$/, "")}${JWKS_SUFFIX}`;
  const iss = clerkIssuer(env);
  return iss ? `${iss}${JWKS_SUFFIX}` : "";
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksUrl = "";

/** Production: a Clerk session token, checked against Clerk's public keys. */
export const verifyClerk: Deps["verify"] = async (token, env) => {
  const url = clerkJwksUrl(env);
  if (!url) throw new Error("Sign-in is not configured on the server");
  if (!jwks || jwksUrl !== url) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksUrl = url;
  }
  const iss = clerkIssuer(env);
  const { payload } = await jwtVerify(token, jwks, { issuer: [iss, `${iss}/`] });
  if (!payload.sub) throw new Error("Token has no subject");
  return { sub: payload.sub };
};

const DEV_RE = /^[a-z0-9_-]{3,40}$/;

/** Returns a user id, or null if the request carries no valid login. */
export async function authenticate(header: string | undefined, env: Env, deps: Deps): Promise<string | null> {
  const m = header?.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1]!.trim();
  if (token.startsWith("dev:")) {
    const name = token.slice(4);
    return env.ALLOW_DEV_AUTH === "1" && DEV_RE.test(name) ? `dev_${name}` : null;
  }
  try {
    return (await deps.verify(token, env)).sub;
  } catch (e) {
    console.error("login token rejected:", (e as Error).message);
    return null;
  }
}

export interface Diagnosis {
  hasToken: boolean;
  serverConfigured: boolean;
  configuredIssuer: string | null;
  tokenIssuer: string | null;
  ok: boolean;
  problem: string | null;
}

/** Explains, in plain words, why a login token was not accepted. Reveals only public information. */
export async function diagnose(header: string | undefined, env: Env, deps: Deps): Promise<Diagnosis> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const configuredIssuer = clerkIssuer(env) || null;
  const out: Diagnosis = { hasToken: !!token, serverConfigured: !!clerkJwksUrl(env), configuredIssuer, tokenIssuer: null, ok: false, problem: null };

  // A test login (only used on a developer machine) is judged by its own switch, not by Clerk's settings.
  if (token?.startsWith("dev:")) {
    out.ok = env.ALLOW_DEV_AUTH === "1" && DEV_RE.test(token.slice(4));
    if (!out.ok) out.problem = "Test logins are switched off on this server. Add your Clerk publishable key to the build (.env.production), deploy again, and sign in with Clerk.";
    return out;
  }
  if (!out.serverConfigured) {
    out.problem = "The server has no sign-in settings. Set CLERK_ISSUER (and CLERK_JWKS_URL), then deploy again: secrets only reach a new deployment.";
    return out;
  }
  if (!token) {
    out.problem = "The browser did not send a login token. Sign out and sign in again.";
    return out;
  }
  try {
    out.tokenIssuer = (decodeJwt(token).iss as string | undefined)?.replace(/\/+$/, "") ?? null;
  } catch {
    out.problem = "The login token is not a valid token.";
    return out;
  }
  if (out.tokenIssuer && configuredIssuer && out.tokenIssuer !== configuredIssuer) {
    out.problem = `The token comes from ${out.tokenIssuer} but the server expects ${configuredIssuer}. CLERK_ISSUER (or CLERK_JWKS_URL) belongs to a different Clerk application. Copy the Frontend API URL from the Clerk app whose publishable key you used.`;
    return out;
  }
  try {
    await deps.verify(token, env);
    out.ok = true;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    out.problem =
      code === "ERR_JWT_EXPIRED" ? "The login token has expired. Sign out and sign in again."
      : code === "ERR_JWKS_NO_MATCHING_KEY" ? "The server fetched Clerk's keys but none match this token. CLERK_JWKS_URL belongs to a different Clerk application."
      : code === "ERR_JWKS_TIMEOUT" || /fetch|network|ENOTFOUND/i.test((e as Error).message) ? "The server could not download Clerk's public keys from CLERK_JWKS_URL. Check that address."
      : `The token was not accepted (${(e as Error).message}).`;
  }
  return out;
}
