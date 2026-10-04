import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Deps, Env } from "./types";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksUrl = "";

/** Production: a Clerk session token, checked against Clerk's public keys. */
export const verifyClerk: Deps["verify"] = async (token, env) => {
  if (!env.CLERK_JWKS_URL) throw new Error("Sign-in is not configured");
  if (!jwks || jwksUrl !== env.CLERK_JWKS_URL) {
    jwks = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL));
    jwksUrl = env.CLERK_JWKS_URL;
  }
  const { payload } = await jwtVerify(token, jwks, env.CLERK_ISSUER ? { issuer: env.CLERK_ISSUER } : {});
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
  } catch {
    return null;
  }
}
