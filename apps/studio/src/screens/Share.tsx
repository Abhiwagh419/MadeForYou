import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BRAND } from "@madeforyou/ui";
import { useAssets } from "../lib/assets";
import { makeStoryImage } from "../lib/story";
import { isRemote } from "../lib/config";
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
  const [story, setStory] = useState<{ url: string; blob: Blob } | null>(null);
  const [making, setMaking] = useState(false);
  const resolve = useAssets(page?.content ?? ({ schemaVersion: 1, settings: {}, blocks: [] } as never));
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
  const hasGuests = page.content.blocks.some((b) => b.type === "wishes" || b.type === "replyBox" || b.type === "rsvp");
  const makeStory = async () => {
    setMaking(true);
    try {
      const cover = hero?.fields.cover as { asset: string } | null | undefined;
      const blob = await makeStoryImage({
        title: String(hero?.fields.title ?? page.title), recipient: hero?.ph.includes("recipient") ? "" : recipient,
        url, theme: page.content.settings.theme.preset, coverUrl: cover && !hero?.ph.includes("cover") ? resolve(cover as never) : undefined,
      });
      setStory({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast((e as Error).message);
    }
    setMaking(false);
  };
  const shareStory = async () => {
    if (!story) return;
    const file = new File([story.blob], `${page.slug}-story.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: message }); return; } catch { /* cancelled: fall back to a download */ }
    }
    const a = document.createElement("a");
    a.href = story.url; a.download = file.name; a.click();
  };

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
            <Button size="lg" variant="secondary" icon="external" href={url} target="_blank" rel="noopener">Open the page</Button>
          </div>

          <div className="note-box">
            <Icon name="globe" size={16} />
            <span>
              {isRemote()
                ? "Anyone with this link can open it on any phone. If you edit the page, the changes go live within a few seconds."
                : `This link works on this device while ${BRAND.name} is being built. When it goes live, the same page and link will open for everyone.`}
            </span>
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

          <div className="pcard">
            <h2>Share to your story</h2>
            <p className="field-hint">A tall picture for Instagram or WhatsApp status, with your page's look and a QR code that opens it.</p>
            {story ? (
              <div className="story-box">
                <img src={story.url} alt="Preview of your story picture" />
                <div className="share-actions">
                  <Button icon="share" onClick={shareStory}>Share the picture</Button>
                  <Button variant="secondary" icon="download" href={story.url} download={`${page.slug}-story.png`}>Download</Button>
                </div>
              </div>
            ) : (
              <div><Button variant="secondary" icon="image" disabled={making} onClick={makeStory}>{making ? "Making it…" : "Make the picture"}</Button></div>
            )}
          </div>

          <div className="share-more">
            {hasGuests && <Button variant="ghost" icon="mail" href={`#/inbox/${id}`}>Messages</Button>}
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
