import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { useSession } from "./lib/auth";
import { isRemote } from "./lib/config";
import { authRetry, handleAuthError, pullPages, refreshOwnerToken, setAuthProblem, useAuthProblem } from "./lib/sync";
import { Button } from "./ui/Button";
import { useRoute } from "./lib/router";
import { Contribute } from "./screens/Contribute";
import { Viewer } from "./screens/Viewer";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Toaster, toast } from "./ui/Controls";
import { HelpNote } from "./ui/HelpNote";
import { NotFound } from "./ui/Shell";


const loaders = {
  Home: () => import("./screens/Home").then((m) => m.Home),
  Templates: () => import("./screens/Templates").then((m) => m.Templates),
  TemplatePreview: () => import("./screens/TemplatePreview").then((m) => m.TemplatePreview),
  Guided: () => import("./screens/Guided").then((m) => m.Guided),
  Editor: () => import("./editor/Editor").then((m) => m.Editor),
  Publish: () => import("./screens/Publish").then((m) => m.Publish),
  Share: () => import("./screens/Share").then((m) => m.Share),
  TemplateFrom: () => import("./screens/TemplateFrom").then((m) => m.TemplateFrom),
  Dashboard: () => import("./screens/Dashboard").then((m) => m.Dashboard),
  Inbox: () => import("./screens/Inbox").then((m) => m.Inbox),
  Status: () => import("./screens/Status").then((m) => m.Status),
  Account: () => import("./screens/Account").then((m) => m.Account),
  Admin: () => import("./screens/Admin").then((m) => m.Admin),
  Support: () => import("./screens/Support").then((m) => m.Support),
  Terms: () => import("./screens/Legal").then((m) => m.Terms),
  Privacy: () => import("./screens/Legal").then((m) => m.Privacy),
  AuthPage: () => import("./screens/AuthPage").then((m) => m.AuthPage),
} satisfies Record<string, () => Promise<ComponentType<any>>>;

const L = Object.fromEntries(Object.entries(loaders).map(([k, load]) => [k, lazy(() => load().then((c) => ({ default: c })))])) as unknown as { [K in keyof typeof loaders]: ComponentType<any> };

export const preloadScreens = () => Promise.all(Object.values(loaders).map((load) => load()));

function SyncOnSignIn() {
  const { userId } = useSession();
  useEffect(() => {
    if (!userId) setAuthProblem(null);
    if (!isRemote() || !userId) return;
    let alive = true;
    (async () => {
      try {
        try {
          await refreshOwnerToken();
        } catch (first) {
          await new Promise((r) => setTimeout(r, authRetry.delayMs));
          if (!alive) return;
          await refreshOwnerToken().catch(() => Promise.reject(first));
        }
        const n = await pullPages();
        if (alive && n) toast(`Brought ${n} page${n === 1 ? "" : "s"} from your account`);
      } catch (e) {
        await handleAuthError(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);
  return null;
}

function LocalModeBanner() {
  const host = window.location.hostname;
  const dev = host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host) || /^10\./.test(host);
  if (isRemote() || dev) return null;
  return (
    <div className="auth-banner" role="alert">
      <div>
        <strong>This copy of the site is running without its server.</strong>
        <span>Pages are saved on this device only and cannot be opened from anywhere else. The site was built without VITE_REMOTE=1.</span>
      </div>
    </div>
  );
}

function AuthProblemBanner() {
  const problem = useAuthProblem();
  const session = useSession();
  if (!problem) return null;
  return (
    <div className="auth-banner" role="alert">
      <div>
        <strong>You are signed in, but the server did not accept your login.</strong>
        <span>{problem}</span>
      </div>
      <Button size="sm" variant="secondary" onClick={session.signOut}>Sign out</Button>
    </div>
  );
}

export function App() {
  const route = useRoute();

  useEffect(() => {
    window.scrollTo?.(0, 0);
    if (route.name !== "view") document.title = "MadeForYou";
  }, [route.name, route.params.id]);

  let screen;
  switch (route.name) {
    case "home": screen = <L.Home />; break;
    case "templates": screen = <L.Templates />; break;
    case "template": screen = <L.TemplatePreview />; break;
    case "make": screen = <L.Guided />; break;
    case "edit": screen = <L.Editor />; break;
    case "publish": screen = <L.Publish />; break;
    case "share": screen = <L.Share />; break;
    case "astemplate": screen = <L.TemplateFrom />; break;
    case "me": screen = <L.Dashboard />; break;
    case "status": screen = <L.Status />; break;
    case "terms": screen = <L.Terms />; break;
    case "privacy": screen = <L.Privacy />; break;
    case "account": screen = <L.Account />; break;
    case "admin": screen = <L.Admin />; break;
    case "support": screen = <L.Support />; break;
    case "signin": screen = <L.AuthPage mode="in" />; break;
    case "signup": screen = <L.AuthPage mode="up" />; break;
    case "inbox": screen = <L.Inbox />; break;
    case "contribute": screen = <Contribute />; break;
    case "view": screen = <Viewer />; break;
    default: screen = <NotFound />;
  }
  return (
    <>
      <LocalModeBanner />
      <AuthProblemBanner />
      <ErrorBoundary key={`${route.name}:${Object.values(route.params).join("/")}`}>
        <Suspense fallback={<main className="wrap" aria-busy="true"><p className="field-hint">Loading…</p></main>}>{screen}</Suspense>
      </ErrorBoundary>
      <SyncOnSignIn />
      <Toaster />
      <HelpNote />
    </>
  );
}
