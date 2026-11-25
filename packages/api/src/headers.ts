export const PERMISSIONS_POLICY = "camera=(), geolocation=(), payment=(), microphone=(self)";

export const CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.openstreetmap.org https://open.spotify.com https://*.clerk.accounts.dev https://challenges.cloudflare.com; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export const HTML_SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": PERMISSIONS_POLICY,
  "content-security-policy-report-only": CSP_REPORT_ONLY,
};
