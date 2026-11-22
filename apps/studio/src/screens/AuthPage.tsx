import { lazy, Suspense } from "react";
import { authMode } from "../lib/config";
import { Button } from "../ui/Button";
import { Shell } from "../ui/Shell";

const ClerkPage = lazy(() => import("../lib/ClerkBridge").then((m) => ({ default: m.AuthPage })));

/** /sign-in and /sign-up: the same Clerk forms as the popup, on a page of our own. */
export function AuthPage({ mode }: { mode: "in" | "up" }) {
  return (
    <Shell>
      <div className="wrap auth-page">
        {authMode() === "clerk" ? (
          <Suspense fallback={<p className="field-hint">Loading…</p>}>
            <ClerkPage mode={mode} />
          </Suspense>
        ) : (
          <>
            <h1>Signing in is not switched on here</h1>
            <p className="field-hint">This copy of the site has no sign-in set up.</p>
            <Button href="/#/" iconRight="right">Back to home</Button>
          </>
        )}
      </div>
    </Shell>
  );
}
