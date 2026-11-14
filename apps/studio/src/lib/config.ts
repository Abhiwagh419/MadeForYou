/** Read lazily so tests can switch modes. Local mode (no backend) is the default. */
export const isRemote = () => import.meta.env.VITE_REMOTE === "1";
export const clerkKey = () => (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? "";
export type AuthMode = "none" | "dev" | "clerk";
export const authMode = (): AuthMode => (!isRemote() ? "none" : clerkKey() ? "clerk" : "dev");
export const apiBase = () => `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api`;

/** The UPI ID people can send support to, from VITE_SUPPORT_UPI in .env.production. Empty (or not a valid UPI ID) hides every "Support us" button. */
export const supportUpi = (): string => {
  const v = ((import.meta.env.VITE_SUPPORT_UPI as string | undefined) ?? "").trim();
  return /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,48}$/.test(v) ? v : "";
};
