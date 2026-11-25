export const isRemote = () => import.meta.env.VITE_REMOTE === "1";
export const clerkKey = () => (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? "";
export type AuthMode = "none" | "dev" | "clerk";
export const authMode = (): AuthMode => (!isRemote() ? "none" : clerkKey() ? "clerk" : "dev");
export const apiBase = () => `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api`;

export const supportUpi = (): string => {
  const v = ((import.meta.env.VITE_SUPPORT_UPI as string | undefined) ?? "").trim();
  if (!/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,48}$/.test(v)) return "";
  if (/^(\+?91)?\d{10}@/.test(v)) return "";
  return v;
};

export const CLERK_ROUTES = { signInUrl: "/sign-in", signUpUrl: "/sign-up", after: "/" } as const;

export const turnstileSiteKey = (): string => {
  const v = ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "").trim();
  return /^[0-9A-Za-z_-]{10,64}$/.test(v) ? v : "";
};
