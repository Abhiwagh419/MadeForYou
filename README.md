# MadeForYou (working name)

Free, no-code personal tribute pages. India-first, mobile-first.
This is the starter monorepo: the data model, the renderer and two launch templates.
The product name lives in one place: `packages/ui/src/brand.ts`.

## Run it

Needs Node 20+ and pnpm 9 (`npm i -g pnpm`).

```
pnpm install
pnpm test          # schema, templates and renderer tests
pnpm typecheck
pnpm studio        # the website: home, search, guided mode, editor, publish, share, dashboard
pnpm renderer-lab  # the old phone-frame harness for renderer work
```

## Layout

| Path | What it is |
|---|---|
| `packages/schema` | Block registry (6 of 26 blocks), Zod validation, migrations hook, template stripping, guided questions, publish check, starter skeleton |
| `packages/renderer` | JSON to page. Never imports the editor. Imports schema as types only, so zod stays out of the recipient bundle |
| `packages/templates` | Launch templates as JSON, validated at load. CI fails on a bad template |
| `packages/ui` | Brand constant and theme tokens |
| `apps/studio` | The website, runs fully in the browser for now: home, search, template preview, guided mode, editor, publish, share (link, WhatsApp, QR), dashboard, share-as-template, and the visitor page with password and unlock gates. Pages and photos are stored in this browser (localStorage and IndexedDB) until the backend exists |
| `apps/preview` | Vite app to see templates on a phone-sized frame and try guided mode, publish check and "share as template" |

Planned, not created yet: `packages/editor`, `packages/i18n`, `apps/web` (Next.js on Cloudflare), `supabase/`.

## Adding a block

1. Add a `BlockDef` in `packages/schema/src/blocks.ts` and register it in `registry.ts`.
2. Add a component in `packages/renderer/src/blocks.tsx` and register it in `COMPONENTS`.

Tags on each field (`personal`, `guided`, `required`, `prompt`, `placeholder`) drive guided mode,
template stripping and the publish check automatically.

## Known gaps

- Only the envelope opening is designed (gift box, curtain, diary fall back to it); "diyas" ambience falls back to a twinkle.
- Renderer UI words (countdown labels) are in `labels.ts`; they move to `packages/i18n`.
- Fonts load from Google Fonts in the preview only. Self-host them in production.
- Checked on desktop and one Android phone (envelope, letter, polaroids, Hindi). The three themes' new fonts and frames are not yet checked.
- User-written text has no Hindi version unless the author adds one; the page falls back to the language it was written in.

## Editing rule

Never assign `block.fields` directly. Use `setField()` from the schema package: it clears the placeholder flag and drops stale translations of that field, so a template's Hindi "माँ" can never hide the name a user typed.

## Studio notes

- Everything is local to the browser. The share link only opens on the same device until Supabase and Cloudflare are connected (milestones M0-M2). Password and unlock gates are enforced in the browser only for now; once live they move to the server.
- A store selector must return a stable value. Select `s.pages`, then derive lists with `useMemo`; a selector that builds a new array each call re-renders forever (a test covers the dashboard).
- Share-as-template refuses titles and search words that contain a name typed on the page (`personalNames`).

## Backend (v6)

`packages/api` is the server: a small Hono app that runs on Cloudflare Pages Functions, with D1 (SQLite) for data and R2 for photos.
It is plain TypeScript with no Cloudflare imports, so it is tested here against a D1-shaped SQLite database (`pnpm test`).

- The server validates everything again (`validateContent`, `checkPublishable`, `validateTemplate`); the browser is never trusted.
- Locked, ended and password states return no content at all. Photos are served only to their owner or to a visitor holding a short-lived token issued after the gates were passed.
- Link previews: `/p/<link>` is rendered by `functions/p/[slug].ts`, which fills in the WhatsApp card. Locked, private and password pages show a generic card so the surprise is not spoiled.
- Without `VITE_REMOTE=1` the studio runs fully in the browser (local mode), as before.

### Go live (all free, no payment card)

Run everything in PowerShell, in `apps\studio`, after `pnpm install` in the project root.

1. `pnpm exec wrangler login` (a browser opens; click Allow).
2. `pnpm exec wrangler d1 create madeforyou`. You do not need to copy the id anywhere: `pnpm run cf:deploy` finds it and writes it into `wrangler.toml` for you (the file is not part of the downloads, so a new version of the code can never erase it).
3. `pnpm exec wrangler d1 migrations apply madeforyou --remote`
4. Clerk (dashboard.clerk.com): create an application. On its **API keys** page copy the **Publishable key** and the **Frontend API URL**. The JWKS URL is that URL plus `/.well-known/jwks.json`.
5. `pnpm exec wrangler pages project create madeforyou --production-branch main`
6. Set four secrets, pasting the value when asked: `pnpm exec wrangler pages secret put NAME --project-name madeforyou` for `SESSION_SECRET` (long random), `CLERK_JWKS_URL`, `CLERK_ISSUER` (the Frontend API URL), `ADMIN_TOKEN` (long random).
7. Copy `.env.production.example` to `.env.production` and put your Clerk publishable key in it.
8. `pnpm run cf:deploy`. It builds and prints your address (`https://madeforyou.pages.dev` or similar).
9. Check `https://YOUR-ADDRESS/api/health` shows `{"ok":true}`, then try the whole journey on your phone.

Photos are stored in the database by default (25 MB per person; the free database holds 500 MB in total). Check how full it is with the admin token:
`Invoke-RestMethod https://YOUR-ADDRESS/api/admin/usage -Headers @{"x-admin-token"="YOUR_ADMIN_TOKEN"}`.
Approve a new creator's public template with `POST /api/admin/templates/<id>/approve` and the same header.
To use R2 instead (Cloudflare asks for a card), uncomment the bucket lines in `wrangler.toml`.

Optional: push to GitHub and add the secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `VITE_CLERK_PUBLISHABLE_KEY`; `.github/workflows/ci.yml` then tests and deploys on every push to `main`.

Local test with a fake login: copy `.dev.vars.example` to `.dev.vars`, build with `VITE_REMOTE=1` and no Clerk key, then `pnpm run cf:dev`.

The Content-Security-Policy in `public/_headers` is report-only. Open the live site, check the browser console for violations, then rename it to `Content-Security-Policy` to enforce it.

## If sign-in works but saving says "please sign in"

The website now shows a banner explaining why the server refused the login (it calls `/api/diag`). The usual causes:
`CLERK_ISSUER` or `CLERK_JWKS_URL` belongs to a different Clerk application than the publishable key, or the secrets were set after the last deploy. Secrets only reach a **new** deployment, so run `pnpm run cf:deploy` again after changing any secret. Either value alone is enough: the server derives the other. Stray spaces, newlines and trailing slashes are ignored.

## Checking a live site (v6.3)

- `https://YOUR-SITE/#/status` shows what the site is connected to: server reachable, sign-in accepted, how many pages are in your account, and a **Sync all my pages now** button that saves everything made on this device to your account.
- `https://YOUR-SITE/api/diag` shows which Clerk address the server expects.
- To look inside the database, always add `--remote`, otherwise wrangler reads an empty local copy:
  `pnpm exec wrangler d1 execute madeforyou --remote --command "SELECT id, owner_id, status, slug FROM pages"`
  (The `users` table only holds an id and a date; names and emails live in Clerk.)
- Deploy as production: `pnpm exec wrangler pages deploy dist --project-name madeforyou --branch main`, then open `https://madeforyou-XXXX.pages.dev` (without the random prefix).

## "database_id" error when deploying

`wrangler.toml` must contain the id of your database (a 36-character code like `1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d`, not a URL). `pnpm run cf:deploy` fills it in automatically. To do it by hand: `pnpm exec wrangler d1 list` prints the name and id; or Cloudflare dashboard, Storage & Databases, D1, madeforyou.

## Blocks (21 of 26)

Built: hero, featured photo, gallery, timeline, days together, video, text, letter, quote/shayari, reasons list, promises/bucket list, open-when letters, countdown, scratch card, the ask, quiz, memory match, event details (with add-to-calendar), buttons/links, divider, signature.
Still to build: voice note, places map, wishes wall, reply box, RSVP (the last three need a submissions endpoint and an inbox).

- Links are stored only as https, http, mailto or tel (`isSafeLink`); videos only as provider + id (`parseVideoUrl`). The renderer keeps its own tiny copy of the link rule so the page does not pull in the schema library; a test keeps the two in step.
- YouTube loads only when the visitor taps the poster, which keeps pages light on slow phones. Thumbnails never load embeds.
- Open-when letters are not time-locked per letter: a real lock must be enforced on the server, and per-letter locks would only be cosmetic.
- Add a block: define it in `packages/schema/src/blocks.ts`, register it in `registry.ts`, add a component in `packages/renderer/src/more.tsx` (and `MORE`), then a description in `apps/studio/src/editor/blockInfo.ts`.

## All 26 blocks, guest messages, voice notes (v8)

Added: voice note (record in the browser, up to a minute), place on a map (OpenStreetMap, loads when tapped), wishes wall, reply box and RSVP.
- Guests' messages are stored by the server (`submissions`, migration 0003). A guest can only send one after getting past the page's lock and password; wishes wait for the owner's approval; the owner reads everything in `#/inbox/<page>` and can download RSVPs for Excel.
- Contributor link: friends add a wish through `/c/<link>?k=...` without ever seeing the page, so a locked surprise stays secret. The owner can switch off all old links.
- Spam protection without any extra service: the guest must have opened the page, a hidden field catches bots, forms filled in under 1.5 s are refused, 5 messages per visitor per 10 minutes, 40 per page per hour, 400 per page. Optional Cloudflare Turnstile: set the secret `TURNSTILE_SECRET`.
- Voice notes are served with byte ranges so they play in Safari.
- Share screen: "Share to your story" makes a 1080 x 1920 picture with the page's look, title and a QR code.
- Run `wrangler d1 migrations apply madeforyou --remote` (or just `pnpm run cf:deploy`, which the CI also does) to add the new tables.
