/** Read lazily so tests can switch modes. Local mode (no backend) is the default. */
export const isRemote = () => import.meta.env.VITE_REMOTE === "1";
export const clerkKey = () => (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? "";
export type AuthMode = "none" | "dev" | "clerk";
export const authMode = (): AuthMode => (!isRemote() ? "none" : clerkKey() ? "clerk" : "dev");
export const apiBase = () => `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api`;

/** The UPI ID people can send support to, from VITE_SUPPORT_UPI in .env.production. Empty (or not a valid UPI ID) hides every "Support us" button. */
export const supportUpi = (): string => {
  const v = ((import.meta.env.VITE_SUPPORT_UPI as string | undefined) ?? "").trim();
  if (!/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,48}$/.test(v)) return "";
  // A UPI ID that is just a mobile number would put that number on a public website, so it is refused on purpose.
  if (/^(\+?91)?\d{10}@/.test(v)) return "";
  return v;
};

/** Where Clerk may send people when it needs a full page. They are pages of OUR site, so nobody lands on Clerk's own hosted page. */
export const CLERK_ROUTES = { signInUrl: "/sign-in", signUpUrl: "/sign-up", after: "/" } as const;
