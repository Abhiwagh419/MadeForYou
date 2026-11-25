import { apiBase } from "./config";

let getToken: () => Promise<string | null> = async () => null;
export const setTokenGetter = (fn: () => Promise<string | null>) => {
  getToken = fn;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
  }
}

interface Opts {
  method?: string;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  auth?: boolean;
}

export async function apiRaw<T = any>(path: string, opts: Opts = {}): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  if (opts.auth !== false) {
    const t = await getToken();
    if (t) headers.authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: opts.method ?? (opts.json !== undefined || opts.body ? "POST" : "GET"),
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  let r;
  try {
    r = await apiRaw<T>(path, opts);
  } catch {
    throw new ApiError(0, "We could not reach the server. Check your connection and try again.");
  }
  if (r.status < 200 || r.status >= 300) throw new ApiError(r.status, (r.data as any)?.error ?? `Something went wrong (${r.status})`, r.data);
  return r.data;
}
