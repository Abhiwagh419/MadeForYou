import { BRAND } from "@madeforyou/ui";
import { supportUpi } from "../lib/config";
import { Button } from "./Button";

export function SupportNudge() {
  if (!supportUpi()) return null;
  return (
    <div className="pcard support-nudge">
      <div>
        <h2>Did {BRAND.name} help you today?</h2>
        <p className="field-hint">It is free, with no ads. If you like, you can chip in any amount to keep it running. If not, that is completely fine.</p>
      </div>
      <Button variant="secondary" icon="heart" href="#/support">Support us</Button>
    </div>
  );
}

export function ViewerPromo() {
  return (
    <aside className="viewer-promo" aria-label={`About ${BRAND.name}`}>
      <h2>Made with {BRAND.name}</h2>
      <p>Say it back with a page of your own, free and in a few minutes.</p>
      <div className="viewer-promo-actions">
        <Button icon="heart" href="/#/templates">Reply with a page</Button>
        <Button variant="secondary" icon="sparkle" href="/#/templates">Create a page like this</Button>
      </div>
      {supportUpi() && <p className="viewer-promo-small">{BRAND.name} has no ads. <a href="/#/support">Help keep it free</a>.</p>}
    </aside>
  );
}
