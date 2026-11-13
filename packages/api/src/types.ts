/** The few Cloudflare methods the API uses, so it runs (and is tested) without the Workers runtime. */
export interface D1Result<T = unknown> { results?: T[]; success?: boolean; meta?: { changes?: number } }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Like {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
export interface R2ObjectLike {
  body: BodyInit | null;
  size: number;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface R2Like {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string | string[]): Promise<void>;
}

export interface Env {
  DB: D1Like;
  /** Optional. With no R2 bucket bound, photos are stored in the database (no payment card needed). */
  FILES?: R2Like;
  /** Signs photo and gate tokens and peppers password hashes. Set with `wrangler pages secret put`. */
  SESSION_SECRET: string;
  CLERK_JWKS_URL?: string;
  CLERK_ISSUER?: string;
  /** "1" only on a developer machine: lets `Authorization: Bearer dev:<name>` stand in for a real login. */
  ALLOW_DEV_AUTH?: string;
  ADMIN_TOKEN?: string;
  /** Extra origin allowed to call the API (local dev with the Vite server on another port). */
  ALLOWED_ORIGIN?: string;
  /** Optional. With a Cloudflare Turnstile secret, guest messages must carry a passed challenge. */
  TURNSTILE_SECRET?: string;
  /** Brevo (free, no card) sends the emails. All three must be set for email to work. */
  BREVO_API_KEY?: string;
  /** A sender address verified in Brevo. */
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  /** Shared with the small scheduler Worker that calls /api/cron/tick every 15 minutes. */
  CRON_SECRET?: string;
  /** Lets the server look up a page owner's email (for "your page ends soon"). Optional. */
  CLERK_SECRET_KEY?: string;
  /** Optional. The main website address, e.g. https://madeforyou-9pj.pages.dev, used in links inside emails. */
  PUBLIC_URL?: string;
}

export interface Deps {
  /** Verifies a login token and returns the user id. Replaced in tests. */
  verify: (token: string, env: Env) => Promise<{ sub: string }>;
  now: () => number;
  /** For the Turnstile check; replaced in tests. */
  fetch: typeof fetch;
}
