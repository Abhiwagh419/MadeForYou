import { BRAND } from "@madeforyou/ui";

export const SUPPORT_AMOUNTS = [20, 50, 100, 200] as const;

export function upiUri(vpa: string, amount?: number): string {
  const q = [`pa=${vpa}`, `pn=${encodeURIComponent(BRAND.operator)}`, "cu=INR", `tn=${encodeURIComponent(`${BRAND.name} support`)}`];
  if (amount && amount > 0) q.push(`am=${amount.toFixed(2)}`);
  return `upi://pay?${q.join("&")}`;
}
