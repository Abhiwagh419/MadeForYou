import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BRAND } from "@madeforyou/ui";
import { useRoute } from "../lib/router";
import { formatWhen, pageUrl, waLink } from "../lib/util";
import { useStore } from "../state/store";
import { Button } from "../ui/Button";
import { toast } from "../ui/Controls";
import { Icon } from "../ui/Icon";
import { NotFound, Shell } from "../ui/Shell";
import { Thumb } from "../ui/Thumb";

export function Share() {
  const { id = "" } = useRoute().params;
  const page = useStore((s) => s.pages[id]);
  const [qr, setQr] = useState("");
  const url = page?.slug ? pageUrl(page.slug) : "";

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 640, color: { dark: "#4A0E1F", light: "#FFF8F0" } }).then(setQr).catch(() => setQr(""));
  }, [url]);

  if (!page || page.status !== "published") return <NotFound />;
  const hero = page.content.blocks.find((b) => b.type === "hero");
  const recipient = String(hero?.fields.recipient ?? "");
  const message = `I made something for ${recipient && !hero?.ph.includes("recipient") ? recipient : "you"}. Open it when you are ready: ${url}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Press and hold the link to copy it");
    }
  };
  const locked = page.access.unlockAt && new Date(page.access.unlockAt).getTime() > Date.now();

  return (
    <Shell>
      <div className="wrap share">
        <div className="share-main">
          <div className="success"><Icon name="check" size={28} /></div>
          <h1>It is live. Now send it.</h1>
          <p className="lede-sm">
            {locked ? <>It stays locked until <b>{formatWhen(page.access.unlockAt)}</b>, with a countdown for whoever opens it early.</> : "Anyone with this link can open it."}
          </p>

          <div className="linkbox">
            <Icon name="link" size={18} />
            <input readOnly value={url} aria-label="Page link" onFocus={(e) => e.target.select()} />
            <Button size="sm" icon="copy" onClick={copy}>Copy</Button>
          </div>

          <div className="share-actions">
            <Button size="lg" icon="whatsapp" href={waLink(message)} target="_blank" rel="noopener noreferrer">Send on WhatsApp</Button>
            <Button size="lg" variant="secondary" icon="external" href={`#/p/${page.slug}`} target="_blank" rel="noopener">Open the page</Button>
          </div>

          <div className="note-box">
            <Icon name="globe" size={16} />
            <span>This link works on this device while {BRAND.name} is being built. When it goes live, the same page and link will open for everyone.</span>
          </div>

          <div className="pcard">
            <h2>What it looks like on WhatsApp</h2>
            <div className="wa-card">
              <div className="wa-thumb"><Thumb content={page.content} /></div>
              <div className="wa-text">
                <strong>{page.title}</strong>
                <span>A page made just for {recipient && !hero?.ph.includes("recipient") ? recipient : "you"}</span>
                <small>{window.location.host}</small>
              </div>
            </div>
          </div>

          <div className="share-more">
            <Button variant="ghost" icon="pencil" href={`#/edit/${id}`}>Keep editing</Button>
            <Button variant="ghost" icon="sparkle" href={`#/template-from/${id}`}>Share as a template</Button>
            <Button variant="ghost" icon="grid" href="#/me">My pages</Button>
          </div>
        </div>

        <aside className="share-side">
          <div className="qrcard">
            {qr ? <img src={qr} alt="QR code for your page link" /> : <div className="qr-skel" />}
            <p>Print it on a card or a gift</p>
            <Button variant="secondary" size="sm" icon="download" href={qr || "#"} download={`${page.slug}-qr.png`}>Download QR</Button>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
