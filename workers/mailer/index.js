// MadeForYou's scheduler. Cloudflare Pages cannot run on a timer, so this tiny Worker wakes up every
// 15 minutes and asks the website to send whatever email is due (pages waiting for their date,
// reminders for guests, "this page ends soon"). It holds no data and sends nothing itself.
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(tick(env));
  },
  async fetch() {
    return new Response("madeforyou-mailer: this Worker runs on a schedule and has no page.", { status: 200 });
  },
};

export async function tick(env, fetchFn = fetch) {
  if (!env.TICK_URL || !env.CRON_SECRET) {
    console.error("Not set up: TICK_URL (in wrangler.toml) and the CRON_SECRET secret are both needed.");
    return { ok: false };
  }
  try {
    const res = await fetchFn(env.TICK_URL, { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    const body = (await res.text()).slice(0, 300);
    console.log("tick", res.status, body);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("tick failed:", e instanceof Error ? e.message : String(e));
    return { ok: false };
  }
}
