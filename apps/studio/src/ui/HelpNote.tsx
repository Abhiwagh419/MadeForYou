import { BRAND } from "@madeforyou/ui";
import { closeHelpNote, useHelpNote } from "../lib/helpNote";
import { Button } from "./Button";
import { Sheet } from "./Controls";

export function HelpNote() {
  const moment = useHelpNote();
  return (
    <Sheet open={!!moment} onClose={closeHelpNote} title="A small favour">
      <p>
        {moment === "publish" ? "Your page is live. " : "Your picture is ready. "}
        {BRAND.name} is free, with no ads, and it runs on very limited resources: one person looks after it, and storage and emails come out of his pocket.
      </p>
      <p>If it helped you, a small contribution keeps it going for the next person. If you would rather not, that is completely fine. Telling a friend about it helps just as much.</p>
      <div className="cta-row">
        <Button variant="secondary" onClick={closeHelpNote}>Not now</Button>
        <Button icon="heart" href="#/support" onClick={closeHelpNote}>Help keep it running</Button>
      </div>
    </Sheet>
  );
}
