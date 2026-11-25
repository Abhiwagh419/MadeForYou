export const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nl = (s: string) => escHtml(s).replace(/\r?\n/g, "<br>");

export type Tone = "rose" | "green" | "amber" | "ink";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  rose: { bg: "#FDE4EA", fg: "#BE123C" },
  green: { bg: "#DDF4E4", fg: "#166534" },
  amber: { bg: "#FEF0CF", fg: "#92400E" },
  ink: { bg: "#F3E8E4", fg: "#4A0E1F" },
};

export interface Fact { label: string; value: string; href?: string }

export interface Layout {
  preheader: string;
  badge?: { label: string; tone: Tone };
  heading: string;
  paragraphs: string[];
  quote?: { label?: string; text: string };
  facts?: Fact[];
  notes?: string[];
  button?: { label: string; url: string };
  footer: string;
  unsubscribeUrl?: string;
}

const SANS = "Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

const brandRow = `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px"><tr>
<td style="width:34px;height:34px;background:#E11D48;border-radius:11px;text-align:center;vertical-align:middle;font-family:Arial,sans-serif;font-size:17px;line-height:34px;color:#ffffff">&#9829;</td>
<td style="padding-left:10px;font-family:${SERIF};font-size:23px;font-weight:bold;color:#4A0E1F;letter-spacing:-0.3px">MadeForYou</td>
</tr></table>`;

const accentBar = `<tr><td height="6" style="height:6px;font-size:0;line-height:0;background:#E11D48;background-image:linear-gradient(90deg,#E11D48,#F59E0B)">&nbsp;</td></tr>`;

function badge(b: NonNullable<Layout["badge"]>) {
  const t = TONES[b.tone];
  return `<p style="margin:0 0 14px"><span style="display:inline-block;background:${t.bg};color:${t.fg};font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:0.6px;text-transform:uppercase;padding:5px 12px;border-radius:999px">${escHtml(b.label)}</span></p>`;
}

function paragraph(t: string) {
  return `<p style="margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:1.6;color:#4A0E1F">${nl(t)}</p>`;
}

function quote(q: NonNullable<Layout["quote"]>) {
  const label = q.label ? `<div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:#7E626A;margin:0 0 6px">${escHtml(q.label)}</div>` : "";
  return `<div style="margin:8px 0 20px;padding:14px 18px;border-left:4px solid #E11D48;background:#FFF8F0;border-radius:4px 12px 12px 4px">${label}<div style="font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.55;color:#4A0E1F">${nl(q.text)}</div></div>`;
}

function facts(list: Fact[]) {
  const rows = list
    .map((f, i) => {
      const value = f.href
        ? `<a href="${escHtml(f.href)}" style="color:#BE123C;text-decoration:underline">${escHtml(f.value)}</a>`
        : nl(f.value);
      const top = i ? "border-top:1px solid #F3DCCB;" : "";
      return `<tr><td style="${top}padding:12px 18px"><div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:0.7px;text-transform:uppercase;color:#7E626A;margin:0 0 3px">${escHtml(f.label)}</div><div style="font-family:${SANS};font-size:15px;line-height:1.5;color:#4A0E1F">${value}</div></td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;background:#FFF8F0;border:1px solid #F3DCCB;border-radius:14px;border-collapse:separate">${rows}</table>`;
}

function notes(list: string[]) {
  const items = list.map((t, i) => `<p style="margin:${i ? "8px" : "0"} 0 0;font-family:${SANS};font-size:14px;line-height:1.55;color:#6B3B12">${nl(t)}</p>`).join("");
  return `<div style="margin:4px 0 22px;padding:14px 18px;background:#FFF6E0;border:1px solid #F8E2A8;border-radius:14px"><div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:0.7px;text-transform:uppercase;color:#92400E;margin:0 0 6px">Good to know</div>${items}</div>`;
}

function button(b: NonNullable<Layout["button"]>) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td bgcolor="#E11D48" style="background:#E11D48;border-radius:999px"><a href="${escHtml(b.url)}" style="display:inline-block;font-family:${SANS};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px">${escHtml(b.label)}</a></td></tr></table>`;
}

export function render(l: Layout): { html: string; text: string } {
  const unsub = l.unsubscribeUrl
    ? `<br><a href="${escHtml(l.unsubscribeUrl)}" style="color:#7E626A;text-decoration:underline">Stop emails like this</a>`
    : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escHtml(l.heading)}</title></head>
<body style="margin:0;padding:0;background:#FFF8F0">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#FFF8F0">${escHtml(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0"><tr><td align="center" style="padding:32px 14px">
${brandRow}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border:1px solid #F3DCCB;border-radius:22px;border-collapse:separate;overflow:hidden">
${accentBar}
<tr><td style="padding:32px 30px 10px">
${l.badge ? badge(l.badge) : ""}
<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:28px;line-height:1.2;font-weight:bold;color:#4A0E1F">${escHtml(l.heading)}</h1>
${l.paragraphs.map(paragraph).join("")}
${l.quote ? quote(l.quote) : ""}
${l.facts?.length ? facts(l.facts) : ""}
${l.notes?.length ? notes(l.notes) : ""}
${l.button ? button(l.button) : ""}
</td></tr>
<tr><td style="padding:0 30px 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #F3DCCB;padding-top:16px;font-family:${SANS};font-size:13px;line-height:1.5;color:#7E626A">Made for you. Made by you.</td></tr></table></td></tr>
</table>
<p style="max-width:500px;margin:18px auto 0;font-family:${SANS};font-size:12px;line-height:1.6;color:#7E626A;text-align:center">${escHtml(l.footer)}${unsub}</p>
</td></tr></table>
</body></html>`;

  const text = [
    l.badge ? l.badge.label.toUpperCase() : "",
    l.heading,
    "",
    ...l.paragraphs.flatMap((t) => [t, ""]),
    ...(l.quote ? [...(l.quote.label ? [`${l.quote.label}:`] : []), `"${l.quote.text}"`, ""] : []),
    ...(l.facts ? [...l.facts.map((f) => `${f.label}: ${f.href ?? f.value}`), ""] : []),
    ...(l.notes ? [...l.notes, ""] : []),
    ...(l.button ? [`${l.button.label}: ${l.button.url}`, ""] : []),
    l.footer,
    ...(l.unsubscribeUrl ? [`Stop emails like this: ${l.unsubscribeUrl}`] : []),
  ]
    .filter((line, i, all) => !(line === "" && (i === 0 || all[i - 1] === "")))
    .join("\n");
  return { html, text };
}
