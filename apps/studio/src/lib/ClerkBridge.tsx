import { useEffect, useMemo, useState } from "react";
import { ClerkProvider, SignIn, SignUp, useAuth, useUser } from "@clerk/clerk-react";
import { Sheet } from "../ui/Controls";
import { CLERK_ROUTES, clerkKey } from "./config";

interface Props {
  onState: (s: { ready: boolean; userId: string | null; label: string; getToken: () => Promise<string | null>; signOut: () => void }) => void;
  open: boolean;
  onClose: () => void;
}

const providerProps = () => ({
  publishableKey: clerkKey(),
  signInUrl: CLERK_ROUTES.signInUrl,
  signUpUrl: CLERK_ROUTES.signUpUrl,
  signInFallbackRedirectUrl: CLERK_ROUTES.after,
  signUpFallbackRedirectUrl: CLERK_ROUTES.after,
  afterSignOutUrl: CLERK_ROUTES.after,
});

const look = {
  variables: {
    colorPrimary: "#E11D48",
    colorText: "#4A0E1F",
    colorTextSecondary: "#6E4A53",
    colorBackground: "transparent",
    colorInputBackground: "#ffffff",
    fontFamily: "Poppins, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "none", background: "transparent" },
    card: { boxShadow: "none", border: "none", background: "transparent", padding: "0.25rem 0 0" },
    header: { display: "none" },
    footer: { background: "transparent" },
    footerAction: { display: "none" },
  },
} as const;

const oauthFlow = () => (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? "redirect" : "popup") as "redirect" | "popup";

function Inner({ onState, open, onClose }: Props) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [mode, setMode] = useState<"in" | "up">("in");
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
        <SignIn routing="virtual" oauthFlow={flow} signUpUrl={CLERK_ROUTES.signUpUrl} forceRedirectUrl={here} appearance={look} />
      ) : (
        <SignUp routing="virtual" oauthFlow={flow} signInUrl={CLERK_ROUTES.signInUrl} forceRedirectUrl={here} appearance={look} />
      )}
      <p className="auth-switch">
        {mode === "in" ? "New to MadeForYou? " : "Already have an account? "}
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Create an account" : "Sign in"}</button>
      </p>
    </Sheet>
  );
}

export default function ClerkBridge(props: Props) {
  return (
    <ClerkProvider {...providerProps()}>
      <Inner {...props} />
    </ClerkProvider>
  );
}

export function AuthPage({ mode }: { mode: "in" | "up" }) {
  return (
    <ClerkProvider {...providerProps()}>
      {mode === "in" ? (
        <SignIn routing="hash" signUpUrl={CLERK_ROUTES.signUpUrl} fallbackRedirectUrl={CLERK_ROUTES.after} appearance={{ variables: look.variables }} />
      ) : (
        <SignUp routing="hash" signInUrl={CLERK_ROUTES.signInUrl} fallbackRedirectUrl={CLERK_ROUTES.after} appearance={{ variables: look.variables }} />
      )}
    </ClerkProvider>
  );
}
