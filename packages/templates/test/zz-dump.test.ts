import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { templates } from "../src";

// QA helper: writes every template with its sample text treated as real content, so layouts can be photographed.
it("dumps templates for visual checks", () => {
  if (!process.env.DUMP_TEMPLATES) return;
  const out = templates.map((t) => {
    const c = structuredClone(t.content);
    c.settings.opening = { ...c.settings.opening, kind: "none" };
    c.settings.ambience = { ...c.settings.ambience, kind: "none" };
    for (const b of c.blocks) {
      b.ph = [];
      b.style.anim = "none";
      if (b.type === "daysTogether") b.fields.since = "2023-02-14";
      if (b.type === "countdown") b.fields.target = "2027-02-14";
      if (b.type === "event") b.fields.when = "2027-02-14T18:30:00+05:30";
      if (b.type === "buttons") b.fields.items = [{ label: "RSVP on WhatsApp", url: "https://wa.me/919876543210" }, { label: "Call us", url: "tel:+919876543210" }];
      if (b.type === "video") b.fields.video = { provider: "youtube", id: "dQw4w9WgXcQ" };
      if (b.type === "map") b.fields.location = { lat: 19.076, lng: 72.8777 };
      if (b.type === "voiceNote") b.fields.audio = { asset: "ast_voice01", seconds: 42 };
    }
    return { id: t.meta.id, title: t.meta.title, content: c };
  });
  writeFileSync("/tmp/qa-templates.json", JSON.stringify(out));
});
