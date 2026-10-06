import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setTokenGetter } from "./api";
import { authMode } from "./config";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Controls";

export interface Session {
  mode: "none" | "dev" | "clerk";
  ready: boolean;
  userId: string | null;
  label: string;
  signIn: () => void;
  signOut: () => void;
}

const NONE: Session = { mode: "none", ready: true, userId: null, label: "", signIn: () => {}, signOut: () => {} };
const Ctx = createContext<Session>(NONE);
export const useSession = () => useContext(Ctx);

/** Production sign-in (Clerk) is loaded only when it is configured. */
const ClerkBridge = lazy(() => import("./ClerkBridge"));

const DEV_KEY = "mfy:dev-user";

function DevAuth({ children }: { children: ReactNode }) {
  const [name, setName] = useState<string | null>(() => localStorage.getItem(DEV_KEY));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setTokenGetter(async () => (name ? `dev:${name}` : null));
  }, [name]);

  const value = useMemo<Session>(
    () => ({
      mode: "dev", ready: true, userId: name ? `dev_${name}` : null, label: name ?? "",
      signIn: () => setOpen(true),
      signOut: () => { localStorage.removeItem(DEV_KEY); setName(null); },
    }),
    [name],
  );
  const submit = () => {
    const n = draft.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (n.length < 3) return;
    localStorage.setItem(DEV_KEY, n);
    setTokenGetter(async () => `dev:${n}`); // ready before the app reacts to being signed in
    setName(n);
    setOpen(false);
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet open={open} onClose={() => setOpen(false)} title="Sign in (development)">
        <p className="muted">Real sign-in with Google or email turns on when you add a Clerk key. For now, pick any name to test with.</p>
        <input className="in" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="a name, like abhi" aria-label="Test name" onKeyDown={(e) => e.key === "Enter" && submit()} style={{ margin: "1rem 0" }} />
        <Button onClick={submit} disabled={draft.length < 3}>Continue</Button>
      </Sheet>
    </Ctx.Provider>
  );
}

function ClerkAuth({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [b, setB] = useState<{ ready: boolean; userId: string | null; label: string; getToken: () => Promise<string | null>; signOut: () => void }>({
    ready: false, userId: null, label: "", getToken: async () => null, signOut: () => {},
  });
  // Registered the moment the sign-in state arrives, not in an effect: effects of child components (which start
  // syncing pages) run BEFORE a parent's effects, so they used to fire with no token and get a "please sign in".
  const onState = useCallback((s: typeof b) => {
    setTokenGetter(s.getToken);
    setB(s);
  }, []);
  const value = useMemo<Session>(
    () => ({ mode: "clerk", ready: b.ready, userId: b.userId, label: b.label, signIn: () => setOpen(true), signOut: b.signOut }),
    [b, setOpen],
  );
  return (
    <Ctx.Provider value={value}>
      <Suspense fallback={null}>
        <ClerkBridge onState={onState} open={open} onClose={() => setOpen(false)} />
      </Suspense>
      {children}
    </Ctx.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = authMode();
  if (mode === "dev") return <DevAuth>{children}</DevAuth>;
  if (mode === "clerk") return <ClerkAuth>{children}</ClerkAuth>;
  return <Ctx.Provider value={NONE}>{children}</Ctx.Provider>;
}
