const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const randomHex = (bytes = 16) => hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer as ArrayBuffer);

export const hashPassword = (secret: string, salt: string, password: string) => hmac(secret, `pw|${salt}|${password}`);

export async function signToken(secret: string, scope: string, ttlSeconds: number, now: number): Promise<string> {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${scope}.${exp}.${await hmac(secret, `tok|${scope}|${exp}`)}`;
}

export async function readToken(secret: string, token: string | undefined | null, now: number): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [scope, exp, sig] = parts as [string, string, string];
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null;
  return timingSafeEqual(sig, await hmac(secret, `tok|${scope}|${exp}`)) ? scope : null;
}

export const hashIp = (secret: string, ip: string) => hmac(secret, `ip|${ip}`);
