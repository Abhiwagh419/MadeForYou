import type { ReactNode } from "react";
import { BRAND } from "@madeforyou/ui";
import { useSession } from "../lib/auth";
import { supportUpi } from "../lib/config";
import { useStore } from "../state/store";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function Topbar({ active }: { active?: "templates" | "me" }) {
  const count = useStore((s) => Object.keys(s.pages).length);
  const session = useSession();
  return (
    <header className="topbar">
      <div className="wrap topbar-in">
        <Logo />
        <nav aria-label="Main">
          <a href="#/templates" className={active === "templates" ? "on" : ""} aria-label="Templates">
            <Icon name="grid" size={18} /><span>Templates</span>
          </a>
          <a href="#/me" className={active === "me" ? "on" : ""} aria-label="My pages">
            <Icon name="layers" size={18} /><span>My pages</span>{count > 0 && <em>{count}</em>}
          </a>
        </nav>
        {session.mode !== "none" && (session.userId
          ? <Button variant="ghost" size="sm" onClick={session.signOut} title={session.label}>Sign out</Button>
          : <Button variant="secondary" size="sm" onClick={session.signIn}>Sign in</Button>)}
        <Button href="#/templates" size="sm" icon="plus" className="topbar-create">Create</Button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>
          <strong className="footer-brand">{BRAND.name}</strong>
          <p>{BRAND.tagline}</p>
        </div>
        <div className="footer-right">
          <p className="footer-note">Free for everyone. No ads, no watermarks you cannot remove, no card needed.</p>
          <nav className="footer-links" aria-label="About and legal">
            {supportUpi() && <a href="#/support" className="footer-support">Support us</a>}
            <a href="#/terms">Terms</a>
            <a href="#/privacy">Privacy</a>
            <a href={`mailto:${BRAND.contactEmail}`}>Contact</a>
            <a href="#/account">Account</a>
            <a href="#/status">Connection status</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children, active }: { children: ReactNode; active?: "templates" | "me" }) {
  return (
    <div className="shell">
      <Topbar active={active} />
      <main className="shell-main">{children}</main>
      <Footer />
    </div>
  );
}

export function NotFound({ what = "page" }: { what?: string }) {
  return (
    <Shell>
      <div className="wrap empty">
        <div className="empty-arch" aria-hidden="true" />
        <h1>We could not find that {what}</h1>
        <p>It may have been deleted, or the link is not quite right.</p>
        <Button href="#/" iconRight="right">Back to home</Button>
      </div>
    </Shell>
  );
}
