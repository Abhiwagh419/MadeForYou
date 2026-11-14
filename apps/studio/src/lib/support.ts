import { BRAND } from "@madeforyou/ui";

/** Amounts offered as one-tap choices, in rupees. Anyone can still pay any amount. */
export const SUPPORT_AMOUNTS = [20, 50, 100, 200] as const;

/** The link a UPI app opens (and the text inside the QR code). The ID is kept readable, the rest is escaped. */
export function upiUri(vpa: string, amount?: number): string {
  const q = [`pa=${vpa}`, `pn=${encodeURIComponent(BRAND.operator)}`, "cu=INR", `tn=${encodeURIComponent(`${BRAND.name} support`)}`];
  if (amount && amount > 0) q.push(`am=${amount.toFixed(2)}`);
  return `upi://pay?${q.join("&")}`;
}
