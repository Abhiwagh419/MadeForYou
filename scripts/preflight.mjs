const site = (process.argv[2] ?? process.env.SITE_URL ?? "").replace(/\/+$/, "");
if (!site) {
  console.error("Usage: node scripts/preflight.mjs https://yourdomain.com");
  process.exit(2);
}

const results = [];
const check = (name, ok, hint = "") => results.push({ name, ok, hint });

const get = async (path) => {
  try {
    const res = await fetch(site + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    return { res, body: await res.text() };
  } catch (e) {
    return { res: null, body: String(e) };
  }
};

const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

check("Site uses https", site.startsWith("https://"), "Use your own domain over https");
check("Site is not on a pages.dev address", !/\.pages\.dev$/.test(new URL(site).hostname), "Move to your own domain so email and sign-in look trustworthy");

const home = await get("/");
check("Home page loads", home.res?.status === 200, "The site did not answer with 200");

const h = home.res?.headers;
const csp = h?.get("content-security-policy");
check("Content-Security-Policy is enforced", !!csp, "Set the CSP_ENFORCE variable to 1 and redeploy");
check("Clickjacking protection", (h?.get("x-frame-options") ?? "").toUpperCase() === "DENY");
check("No sniffing", (h?.get("x-content-type-options") ?? "").toLowerCase() === "nosniff");
check("Clerk development host is gone from the CSP", !/clerk\.accounts\.dev/.test(csp ?? ""), "Set CLERK_FRONTEND_HOST to your production Clerk domain");

const health = await get("/api/health");
check("API health", json(health.body).ok === true, "Check the D1 binding and the deployment");

const mail = json((await get("/api/mail/status")).body);
check("Email is switched on", mail.email === true, "Set BREVO_API_KEY and MAIL_FROM, then redeploy");
check("Reminders are switched on", mail.reminders === true, "Deploy the mailer worker and set CRON_SECRET");

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok || !r.hint ? "" : `  ->  ${r.hint}`}`);
console.log(failed.length ? `\n${failed.length} to fix before launch` : "\nAll checks passed");
process.exit(failed.length ? 1 : 0);
