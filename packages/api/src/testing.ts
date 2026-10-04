import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { jwtVerify } from "jose";
import { createApp } from "./app";
import type { D1Like, D1PreparedStatement, Deps, Env, R2Like } from "./types";

/** A D1-shaped database on top of node:sqlite, running the real migration file. */
export function makeDb(): D1Like {
  const db = new DatabaseSync(":memory:");
  const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../migrations/0001_init.sql"), "utf8");
  db.exec(sql);
  const stmt = (query: string, args: unknown[] = []): D1PreparedStatement => ({
    bind: (...v: unknown[]) => stmt(query, v),
    first: async <T>() => ((db.prepare(query).get(...(args as never[])) as T | undefined) ?? null),
    all: async <T>() => ({ results: db.prepare(query).all(...(args as never[])) as T[] }),
    run: async () => {
      const r = db.prepare(query).run(...(args as never[]));
      return { success: true, meta: { changes: Number(r.changes) } };
    },
  });
  return {
    prepare: (q) => stmt(q),
    batch: async (list) => {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of list) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

export function makeBucket(): R2Like & { keys: () => string[] } {
  const m = new Map<string, { buf: ArrayBuffer; type?: string }>();
  return {
    put: async (k, v, o) => void m.set(k, { buf: v, type: o?.httpMetadata?.contentType }),
    get: async (k) => {
      const o = m.get(k);
      return o ? { body: o.buf, size: o.buf.byteLength, httpMetadata: { contentType: o.type } } : null;
    },
    delete: async (k) => void [k].flat().forEach((x) => m.delete(x)),
    keys: () => [...m.keys()],
  };
}

export const SECRET = "test-secret-test-secret-test-secret";

export function makeEnv(extra: Partial<Env> = {}): Env & { FILES: ReturnType<typeof makeBucket> } {
  return { DB: makeDb(), FILES: makeBucket(), SESSION_SECRET: SECRET, ALLOW_DEV_AUTH: "1", ADMIN_TOKEN: "admin-token-123", ...extra } as never;
}

export function makeClient(env: Env, deps: Partial<Deps> = {}) {
  const app = createApp(deps);
  return async (method: string, path: string, opts: { user?: string; json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.user) headers.authorization = `Bearer dev:${opts.user}`;
    let body = opts.body;
    if (opts.json !== undefined) {
      body = JSON.stringify(opts.json);
      headers["content-type"] = "application/json";
    }
    const res = await app.request(`/api${path}`, { method, headers, body }, env);
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* binary or empty */
    }
    return { status: res.status, json, text, headers: res.headers };
  };
}

/** A real RS256 login token signed by a throwaway key, checked through a local key set. */
export async function makeJwtSetup() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const set = createLocalJWKSet({ keys: [jwk] });
  const sign = (sub: string, o: { iss?: string; exp?: string } = {}) =>
    new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: "k1" }).setSubject(sub).setIssuer(o.iss ?? "https://clerk.test").setIssuedAt().setExpirationTime(o.exp ?? "1h").sign(privateKey);
  const verify: Deps["verify"] = async (token) => {
    const { payload } = await jwtVerify(token, set, { issuer: "https://clerk.test" });
    return { sub: payload.sub! };
  };
  return { sign, verify };
}
