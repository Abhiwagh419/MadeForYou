import { HTML_SECURITY_HEADERS, renderPageShell, type Env } from "@madeforyou/api";

type Ctx = { request: Request; env: Env & { ASSETS: { fetch: (r: Request) => Promise<Response> } }; params: { slug?: string | string[] } };

/** /p/<link>: the app, with this page's link-preview tags filled in so WhatsApp shows a proper card. */
export async function onRequestGet({ request, env, params }: Ctx) {
  const url = new URL(request.url);
  const shell = await (await env.ASSETS.fetch(new Request(new URL("/", url)))).text();
  const slug = String(Array.isArray(params.slug) ? params.slug[0] : params.slug ?? "").toLowerCase();
  const html = await renderPageShell(env, shell, url.origin, slug);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow, noarchive", ...HTML_SECURITY_HEADERS } });
}
