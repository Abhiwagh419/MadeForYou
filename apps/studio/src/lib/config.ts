/** Read lazily so tests can switch modes. Local mode (no backend) is the default. */
export const isRemote = () => import.meta.env.VITE_REMOTE === "1";
export const clerkKey = () => (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? "";
export type AuthMode = "none" | "dev" | "clerk";
export const authMode = (): AuthMode => (!isRemote() ? "none" : clerkKey() ? "clerk" : "dev");
export const apiBase = () => `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api`;
