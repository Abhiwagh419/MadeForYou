import type { ReactNode } from "react";
import { BRAND } from "@madeforyou/ui";
import { useStore } from "../state/store";
import { Button } from "./Button";
import { Logo } from "./Logo";

export function Topbar({ active }: { active?: "templates" | "me" }) {
  const count = useStore((s) => Object.keys(s.pages).length);
  return (
    <header className="topbar">
      <div className="wrap topbar-in">
        <Logo />
        <nav aria-label="Main">
          <a href="#/templates" className={active === "templates" ? "on" : ""}>Templates</a>
          <a href="#/me" className={active === "me" ? "on" : ""}>My pages{count > 0 && <em>{count}</em>}</a>
        </nav>
        <Button href="#/templates" size="sm" icon="plus">Create</Button>
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
        <p className="footer-note">Free for everyone. No ads, no watermarks you cannot remove, no card needed.</p>
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
