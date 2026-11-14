/**
 * The ONE place the product name lives. The domain is still undecided and the
 * name may be reopened, so nothing else in the codebase hard-codes it.
 */
export const BRAND = {
  name: "MadeForYou",
  tagline: "Made for you. Made by you.",
  badgeText: "Made with MadeForYou",
  domain: null as string | null, // set once a domain is bought
  /** Who runs the service, and where reports and privacy questions go. Shown on the Terms and Privacy pages. */
  operator: "Abhishek Wagh",
  contactEmail: "wabhi2009@gmail.com",
  colors: {
    rose: "#E11D48",
    marigold: "#F59E0B",
    cream: "#FFF8F0",
    maroon: "#4A0E1F",
  },
} as const;
