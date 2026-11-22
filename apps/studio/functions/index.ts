import { HTML_SECURITY_HEADERS, injectMeta, type Env } from "@madeforyou/api";

type Ctx = { request: Request; env: Env & { ASSETS: { fetch: (r: Request) => Promise<Response> } } };

/** The home page, with its own link-preview card. */
export async function onRequestGet({ request, env }: Ctx) {
  const url = new URL(request.url);
  const shell = await (await env.ASSETS.fetch(request)).text();
  const html = injectMeta(shell, {
    title: "MadeForYou: a page made just for them",
    description: "Free, beautiful personal pages for mothers, partners, friends and festivals. No design skills needed.",
    image: `${url.origin}/og-default.png`,
    url: url.origin,
  });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...HTML_SECURITY_HEADERS } });
}
