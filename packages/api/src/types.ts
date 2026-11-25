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
  FILES?: R2Like;
  SESSION_SECRET: string;
  CLERK_JWKS_URL?: string;
  CLERK_ISSUER?: string;
  ALLOW_DEV_AUTH?: string;
  ADMIN_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
  TURNSTILE_SECRET?: string;
  BREVO_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  CRON_SECRET?: string;
  CLERK_SECRET_KEY?: string;
  PUBLIC_URL?: string;
  REPORT_EMAIL?: string;
}

export interface Deps {
  verify: (token: string, env: Env) => Promise<{ sub: string }>;
  now: () => number;
  fetch: typeof fetch;
}
