/** One cell of a CSV. Cells that a spreadsheet would run as a formula are made plain text first. */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface RsvpRow { name: string; response: string; guests: number; note?: string; createdAt: string }

export function rsvpCsv(rows: RsvpRow[]): string {
  const head = ["Name", "Answer", "Guests", "Note", "Received"];
  const lines = rows.map((r) => [r.name, r.response, r.guests, r.note ?? "", r.createdAt].map(csvCell).join(","));
  return `\ufeff${[head.join(","), ...lines].join("\r\n")}\r\n`; // the BOM makes Excel read Hindi names correctly
}

export function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}
