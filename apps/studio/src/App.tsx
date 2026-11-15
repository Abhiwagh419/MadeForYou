import { useEffect } from "react";
import { useSession } from "./lib/auth";
import { isRemote } from "./lib/config";
import { authRetry, handleAuthError, pullPages, refreshOwnerToken, setAuthProblem, useAuthProblem } from "./lib/sync";
import { Button } from "./ui/Button";
import { Editor } from "./editor/Editor";
import { useRoute } from "./lib/router";
import { Dashboard } from "./screens/Dashboard";
import { Guided } from "./screens/Guided";
import { Contribute } from "./screens/Contribute";
import { Home } from "./screens/Home";
import { Inbox } from "./screens/Inbox";
import { Status } from "./screens/Status";
import { Account } from "./screens/Account";
import { AuthPage } from "./screens/AuthPage";
import { Admin } from "./screens/Admin";
import { Privacy, Terms } from "./screens/Legal";
import { Support } from "./screens/Support";
import { Publish } from "./screens/Publish";
import { Share } from "./screens/Share";
import { TemplateFrom } from "./screens/TemplateFrom";
import { TemplatePreview } from "./screens/TemplatePreview";
import { Templates } from "./screens/Templates";
import { Viewer } from "./screens/Viewer";
import { Toaster, toast } from "./ui/Controls";
import { NotFound } from "./ui/Shell";

/** When someone signs in: fetch their photo access, then bring their saved pages onto this device. */
function SyncOnSignIn() {
  const { userId } = useSession();
  useEffect(() => {
    if (!isRemote() || !userId) return;
    let alive = true;
    (async () => {
      try {
        try {
          await refreshOwnerToken();
        } catch (first) {
          // one quiet retry: a login can take a moment to become usable right after sign-in
          await new Promise((r) => setTimeout(r, authRetry.delayMs));
          if (!alive) return;
          await refreshOwnerToken().catch(() => Promise.reject(first));
        }
        const n = await pullPages();
        if (alive && n) toast(`Brought ${n} page${n === 1 ? "" : "s"} from your account`);
      } catch (e) {
        // A refused login is explained on screen; being offline is not an error: everything keeps working here.
        await handleAuthError(e);
      }
    })();
    return () => {
      alive = false;
    };
    if (!userId) setAuthProblem(null);
  }, [userId]);
  return null;
}

/** A deployed copy built without the server would silently keep everything on one phone. Say so. */
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
    case "home": screen = <Home />; break;
    case "templates": screen = <Templates />; break;
    case "template": screen = <TemplatePreview />; break;
    case "make": screen = <Guided />; break;
    case "edit": screen = <Editor />; break;
    case "publish": screen = <Publish />; break;
    case "share": screen = <Share />; break;
    case "astemplate": screen = <TemplateFrom />; break;
    case "me": screen = <Dashboard />; break;
    case "status": screen = <Status />; break;
    case "terms": screen = <Terms />; break;
    case "privacy": screen = <Privacy />; break;
    case "account": screen = <Account />; break;
    case "admin": screen = <Admin />; break;
    case "support": screen = <Support />; break;
    case "signin": screen = <AuthPage mode="in" />; break;
    case "signup": screen = <AuthPage mode="up" />; break;
    case "inbox": screen = <Inbox />; break;
    case "contribute": screen = <Contribute />; break;
    case "view": screen = <Viewer />; break;
    default: screen = <NotFound />;
  }
  return (
    <>
      <LocalModeBanner />
      <AuthProblemBanner />
      {screen}
      <SyncOnSignIn />
      <Toaster />
    </>
  );
}
