import { block } from "./build";

export const sign = (message = "With love,") => block("signature", { fields: { message, name: "Your name" }, style: { anim: "fade" } });

export const rangoli = () => block("divider", { fields: { style: "rangoli" }, style: { space: "sm" } });

export const floral = () => block("divider", { fields: { style: "floral" }, style: { space: "sm" } });

export const starsLine = () => block("divider", { fields: { style: "stars" }, style: { space: "sm" } });

export const cover = (title: string, recipient: string, subtitle: string, hi?: { title: string; recipient: string; subtitle: string }) =>
  block("hero", { final: ["title"], fields: { title, recipient, subtitle }, ...(hi ? { hi } : {}) });

export const list = (...items: string[]) => items.map((text) => ({ text }));
