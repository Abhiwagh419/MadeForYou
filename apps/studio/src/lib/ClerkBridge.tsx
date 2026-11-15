import { useEffect, useMemo, useState } from "react";
import { ClerkProvider, SignIn, SignUp, useAuth, useUser } from "@clerk/clerk-react";
import { Sheet } from "../ui/Controls";
import { CLERK_ROUTES, clerkKey } from "./config";

interface Props {
  onState: (s: { ready: boolean; userId: string | null; label: string; getToken: () => Promise<string | null>; signOut: () => void }) => void;
  open: boolean;
  onClose: () => void;
}

/** One set of settings for every Clerk component, so none of them can fall back to Clerk's hosted pages. */
const providerProps = () => ({
  publishableKey: clerkKey(),
  signInUrl: CLERK_ROUTES.signInUrl,
  signUpUrl: CLERK_ROUTES.signUpUrl,
  signInFallbackRedirectUrl: CLERK_ROUTES.after,
  signUpFallbackRedirectUrl: CLERK_ROUTES.after,
  afterSignOutUrl: CLERK_ROUTES.after,
});

/** Our own "new here / already have an account" switch replaces Clerk's link, which would leave the popup. */
const HIDE_SWITCH_LINK = { elements: { footerAction: { display: "none" } } } as const;

/** Google opens in a small popup window on computers. On phones a popup is unreliable, so the page itself goes to Google and comes back. */
const oauthFlow = () => (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? "redirect" : "popup") as "redirect" | "popup";

function Inner({ onState, open, onClose }: Props) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [mode, setMode] = useState<"in" | "up">("in");
  // After signing in the person stays exactly where they were (for example on the Publish screen).
  const here = useMemo(() => (open ? window.location.href : ""), [open]);
  const flow = useMemo(oauthFlow, []);

  useEffect(() => {
    onState({
      ready: isLoaded,
      userId: isSignedIn ? userId ?? null : null,
      label: user?.primaryEmailAddress?.emailAddress ?? user?.firstName ?? "",
      getToken: async () => (isSignedIn ? getToken() : null),
      signOut: () => void signOut(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, userId, user]);

  useEffect(() => {
    if (isSignedIn && open) onClose();
  }, [isSignedIn, open, onClose]);
  useEffect(() => {
    if (open) setMode("in");
  }, [open]);

  return (
    <Sheet open={open && !isSignedIn} onClose={onClose} title={mode === "in" ? "Sign in to MadeForYou" : "Create your MadeForYou account"}>
      {mode === "in" ? (
        <SignIn routing="virtual" oauthFlow={flow} signUpUrl={CLERK_ROUTES.signUpUrl} forceRedirectUrl={here} appearance={HIDE_SWITCH_LINK} />
      ) : (
        <SignUp routing="virtual" oauthFlow={flow} signInUrl={CLERK_ROUTES.signInUrl} forceRedirectUrl={here} appearance={HIDE_SWITCH_LINK} />
      )}
      <p className="auth-switch">
        {mode === "in" ? "New to MadeForYou? " : "Already have an account? "}
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Create an account" : "Sign in"}</button>
      </p>
    </Sheet>
  );
}

/** Loaded on demand, only when a Clerk key is configured. */
export default function ClerkBridge(props: Props) {
  return (
    <ClerkProvider {...providerProps()}>
      <Inner {...props} />
    </ClerkProvider>
  );
}

/** The full-page versions, at /sign-in and /sign-up on our own site. Clerk uses them to finish a Google sign-in and in rare detours. */
export function AuthPage({ mode }: { mode: "in" | "up" }) {
  return (
    <ClerkProvider {...providerProps()}>
      {mode === "in" ? (
        <SignIn routing="hash" signUpUrl={CLERK_ROUTES.signUpUrl} fallbackRedirectUrl={CLERK_ROUTES.after} />
      ) : (
        <SignUp routing="hash" signInUrl={CLERK_ROUTES.signInUrl} fallbackRedirectUrl={CLERK_ROUTES.after} />
      )}
    </ClerkProvider>
  );
}
