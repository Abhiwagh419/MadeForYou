# MadeForYou

Free, no-code personal tribute pages. India-first, mobile-first. Pick a template, answer a few questions, add photos, and send a page to someone you love as a link, a WhatsApp card, a QR code or a story picture.

The product name, the operator and the contact email live in one place: `packages/ui/src/brand.ts`.

## What it does

- **26 blocks**: hero, featured photo, gallery, timeline, days together, video, text, letter, quote/shayari, reasons list, promises/bucket list, open-when letters, countdown, scratch card, the ask, quiz, memory match, event details (add to calendar), buttons/links, divider, signature, voice note, place on a map, wishes wall, reply box, RSVP.
- **Guided mode and an editor**, English and Hindi, with templates, themes and a phone preview.
- **Photos you crop yourself**: choose the part to show; the page shows exactly your crop (the cover frame and memory cards keep the theme's shape).
- **Publish and share**: link, WhatsApp card, QR code, a 1080 x 1920 story picture, password, "opens on" lock, end date, private mode.
- **Guest messages**: wishes (with approval), replies and RSVPs, read in an inbox; friends can add a wish through a contributor link without seeing the page.
- **Email** (optional, free): send a page to someone on a date, one reminder to guests before an event, and "this page ends soon".
- **Safety**: Terms and Privacy pages, "Report this page", a review page for the site owner, takedowns, and "Delete my account and all my data".
- **Support us** (optional): a quiet page where people can pay any amount by UPI.

## Run it on your computer

Needs Node 20+ and pnpm 9 (`npm i -g pnpm@9`).

```
pnpm install
pnpm test          # all tests (450)
pnpm typecheck
pnpm studio        # the website, in local mode (see below)
```

**Local mode** (the default) keeps pages and photos in this browser. There is no server, no login and no email, and a share link only opens on the same computer. Use it to try the design.

**Live mode** needs the backend (below). To try the real backend on your own computer with a fake login: copy `apps/studio/.dev.vars.example` to `apps/studio/.dev.vars`, apply the database with `pnpm exec wrangler d1 migrations apply madeforyou --local`, build with `VITE_REMOTE=1` and no Clerk key, then run `pnpm run cf:dev` in `apps/studio`.

## Layout

| Path | What it is |
|---|---|
| `packages/schema` | Block registry (26 blocks), Zod validation, template stripping, guided questions, publish check, guest-message cleaning, email check |
| `packages/renderer` | JSON to page. Never imports the editor. Imports the schema as types only |
| `packages/templates` | Launch templates as JSON, validated at load |
| `packages/ui` | Brand constants and theme tokens |
| `packages/api` | The server: a Hono app, plain TypeScript, tested against a D1-shaped SQLite. Pages, photos, guest messages, email, reports, account deletion, the scheduled job |
| `apps/studio` | The website (Vite + React) and the Cloudflare Pages Functions that wrap the API (`functions/`) |
| `workers/mailer` | A tiny Worker that wakes up every 15 minutes and asks the website to send due email and clean up old data |
| `apps/preview` | A phone-frame harness for template work |

## Go live (free, no payment card)

Everything is run in PowerShell, in `apps\studio`, after `pnpm install` in the project root.

1. `pnpm exec wrangler login` (a browser opens; click Allow).
2. `pnpm exec wrangler d1 create madeforyou`. You do not need to copy the id: `pnpm run cf:deploy` finds it and writes `wrangler.toml` for you. That file is not part of the downloads, so new code never erases it.
3. **Clerk** (dashboard.clerk.com): create an application. On **API keys** copy the **Publishable key** and the **Frontend API URL**. The JWKS URL is that URL plus `/.well-known/jwks.json`.
4. `pnpm exec wrangler pages project create madeforyou --production-branch main`
5. Set the required secrets (paste the value when asked): `pnpm exec wrangler pages secret put NAME --project-name madeforyou`
6. Create `apps/studio/.env.production` (see "Settings that go in `.env.production`" below).
7. `pnpm run cf:deploy`. It applies the database changes, builds and deploys, and prints your address.
8. Open `https://YOUR-ADDRESS/api/health` (should show `{"ok":true}`), then try the whole journey on your phone.

**Secrets only reach a new deployment**: after changing any secret, run `pnpm run cf:deploy` again.

### Secrets (set with `wrangler pages secret put`)

| Secret | Needed? | What it is |
|---|---|---|
| `SESSION_SECRET` | yes | Long random text. Signs the short-lived tokens for photos and unsubscribe links |
| `CLERK_JWKS_URL` | yes | Your Clerk Frontend API URL plus `/.well-known/jwks.json` |
| `CLERK_ISSUER` | yes | Your Clerk Frontend API URL. Either this or the JWKS URL is enough; the server derives the other |
| `ADMIN_TOKEN` | yes | Long random text. Opens your review page `#/admin` |
| `BREVO_API_KEY` | for email | Brevo: Settings, SMTP & API, API keys |
| `MAIL_FROM` | for email | A sender address verified in Brevo (Settings, Senders) |
| `MAIL_FROM_NAME` | optional | The name people see. Default: MadeForYou |
| `CRON_SECRET` | for email and clean-up | Any long random text. The same value must be given to the scheduler (below) |
| `CLERK_SECRET_KEY` | optional | Lets the server find an owner's email for "ends soon", and remove the Clerk login when an account is deleted |
| `REPORT_EMAIL` | optional | Where "page reported" notes go. Default: `MAIL_FROM` |
| `PUBLIC_URL` | recommended | Your main address, e.g. `https://madeforyou-9pj.pages.dev`. Used in email links so they never show a one-off deploy address |
| `TURNSTILE_SECRET` | optional | Cloudflare Turnstile secret key. With `VITE_TURNSTILE_SITE_KEY` it switches on the spam check (see below). Set both together |

Never commit secrets, and never paste them into chats. Paste them only into the prompt.

### Settings that go in `apps/studio/.env.production`

This file is not committed (it is ignored by git). Vite reads it when building.

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPPORT_UPI=yourname@yourbank
VITE_TURNSTILE_SITE_KEY=0x4AAAA...
```

`VITE_SUPPORT_UPI` is optional. Leave it out and every "Support us" button stays hidden. `VITE_TURNSTILE_SITE_KEY` is optional too; leave it out and the spam check is off. Use a name-based UPI ID, not one made of your mobile number: it is shown to everyone, and an ID that is a phone number is refused on purpose. If the page shows an old value after a redeploy, see "The Support button shows an old UPI ID" under Troubleshooting. With GitHub Actions, put the same two values in the repository's secrets/variables (`VITE_CLERK_PUBLISHABLE_KEY` as a secret, `VITE_SUPPORT_UPI` and `VITE_TURNSTILE_SITE_KEY` as variables).

### The scheduler (needed for email and clean-up)

Cloudflare Pages cannot run on a timer, so `workers/mailer` calls `/api/cron/tick` every 15 minutes. Deploy it once:

```
pnpm run mailer:secret    # paste the same CRON_SECRET; answer Y when it offers to create the Worker
pnpm run mailer:deploy
```

Check `TICK_URL` in `workers/mailer/wrangler.toml` first (your main address plus `/api/cron/tick`). In the Cloudflare dashboard, Workers & Pages, `madeforyou-mailer`, Logs, you should see `tick 200`. `tick 401` means the two `CRON_SECRET` values differ; `tick 503` means the website has none or was not redeployed.

Each run: sends due emails, then removes pages deleted more than 30 days ago, photos no page uses, and handled reports older than a year.

### Photos

Photos live in the database by default (25 MB per person; the free database holds 500 MB in total). To use R2 instead (Cloudflare asks for a card), uncomment the bucket lines in `wrangler.toml`.

## Spam check on guest forms (Turnstile, free)

Wishes, replies, RSVPs, contributor wishes and "Report this page" can be protected by Cloudflare Turnstile. It is almost always invisible; it shows a tick box only when Cloudflare is unsure, and says "We could not confirm you are a person" if the check fails.

1. Cloudflare dashboard, **Turnstile**, **Add widget**. Name it MadeForYou, add the hostname of your site (for example `madeforyou-9pj.pages.dev`; its subdomains are covered), choose the **Managed** mode.
2. Copy the **Site key** (public) and the **Secret key** (private).
3. Put the site key in `apps/studio/.env.production` as `VITE_TURNSTILE_SITE_KEY=...`.
4. Set the secret: `pnpm exec wrangler pages secret put TURNSTILE_SECRET --project-name madeforyou`.
5. `pnpm run cf:deploy`, then post a test wish from a private window.

Set the site key and the secret in the same deploy: the server starts demanding the check as soon as it has the secret. To switch it off, delete the secret (`wrangler pages secret delete TURNSTILE_SECRET --project-name madeforyou`) and redeploy. For a dry run, Cloudflare publishes test keys (site key `1x00000000000000000000AA` always passes, secret `1x0000000000000000000000000000000AA`). If real guests are refused, check that the widget's hostname list matches your address. Visitors with an ad blocker that blocks `challenges.cloudflare.com` cannot post.

## Email

Sent through Brevo's free plan (300 a day, no card). Email stays off until `BREVO_API_KEY` and `MAIL_FROM` are set; reminders and "ends soon" also need the scheduler.

1. **A page sent to someone on a date**: Share screen, "Send it by email". Now or on a date you pick. 5 people per page, 10 a day per owner.
2. **One reminder for guests** who add an email on the RSVP: a day before the event. The address is asked for only for that, and only from guests who said yes or maybe. It stays with the guest's reply, which the page's owner can see, until the reply, the page or the account is deleted.
3. **"This page ends soon"**: a day before a page's end date, to the owner (needs `CLERK_SECRET_KEY`) and to people the page was emailed to.

Every email has a stop link. It opens a confirmation page (so mail scanners cannot trigger it), and an address that stopped is never emailed again by anyone. The daily total is held under 280.

Without a domain of your own, mail goes out from your verified address through Brevo, and mail from a Gmail-style address can land in spam. A domain you own fixes that.

## Safety

- **Terms** (`#/terms`) and **Privacy** (`#/privacy`): the words are in `apps/studio/src/lib/legal.ts`; the operator and contact email are in `brand.ts`. **If you change what the app stores or which companies handle data, change the Privacy page too.** Linked from the footer and from the Publish screen.
- **Report this page**: at the bottom of every public page (not shown to its owner). Visitors choose a reason; 5 reports an hour per visitor. Saved, and emailed to `REPORT_EMAIL` if email is on.
- **Your review page**, `#/admin`: asks for `ADMIN_TOKEN` (kept in that browser tab only). Open a reported page, dismiss the report, take the page down (its owner cannot publish it again) or restore it.
- **Delete my account**, `#/account`: removes pages, photos, visitor messages, scheduled emails and templates at once, and the Clerk login if `CLERK_SECRET_KEY` is set. The person types DELETE to confirm.
- **Clean-up**: see "The scheduler".

## Support us (UPI)

A donate-what-you-like page at `#/support`, linked in the footer and gently on the Share screen. It shows a QR code and a "Pay with a UPI app" button, with one-tap amounts (₹20, ₹50, ₹100, ₹200) or any amount. Set `VITE_SUPPORT_UPI` to switch it on (see above), then redeploy.

Payments go straight from the payer's UPI app to your bank account. The website never touches the money or sees bank details. Change the wording in `apps/studio/src/screens/Support.tsx`, and keep the Terms and Privacy mentions in step.

## Everyday operations

- **See how full the database is**: `Invoke-RestMethod https://YOUR-ADDRESS/api/admin/usage -Headers @{"x-admin-token"="YOUR_ADMIN_TOKEN"}`, or open `#/admin`.
- **Approve a new creator's public template**: `POST /api/admin/templates/<id>/approve` with the same header.
- **Back up** (do this weekly): `pnpm exec wrangler d1 export madeforyou --remote --output backup.sql` and keep the file somewhere safe. Photos are inside the database, so this covers them too.
- **Look inside the database**: always add `--remote`, otherwise wrangler reads an empty local copy: `pnpm exec wrangler d1 execute madeforyou --remote --command "SELECT id, owner_id, status, slug FROM pages"`.
- **Is it connected?** `https://YOUR-SITE/#/status` shows the server, sign-in, how many pages are in your account, and a **Sync all my pages now** button. `https://YOUR-SITE/api/diag` shows which Clerk address the server expects. `https://YOUR-SITE/api/mail/status` shows whether email and reminders are on.
- **Update the site**: copy new files over the project, `pnpm test`, then `pnpm run cf:deploy` from `apps\studio`.
- **Deploy by hand as production**: `pnpm exec wrangler pages deploy dist --project-name madeforyou --branch main`, then open the address without the random prefix.

Optional: push to GitHub and add the secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `VITE_CLERK_PUBLISHABLE_KEY` (and the variable `VITE_SUPPORT_UPI`); `.github/workflows/ci.yml` then tests and deploys on every push to `main`.

## Troubleshooting

- **Sign-in works but saving says "please sign in"**: the site shows a banner explaining why (it calls `/api/diag`). Usually `CLERK_ISSUER` or `CLERK_JWKS_URL` belongs to a different Clerk application than the publishable key, or secrets were set after the last deploy. Run `pnpm run cf:deploy` again. Stray spaces, newlines and trailing slashes are ignored.
- **"database_id" error when deploying**: `wrangler.toml` must hold the 36-character id of your database (not a URL). `pnpm run cf:deploy` fills it in; by hand, `pnpm exec wrangler d1 list` prints it.
- **Sign-in sends people to a Clerk page (`accounts.dev`)**: sign-in is meant to stay on your site. The "Sign in" button opens a popup on the page; Google opens in a small window on computers (on phones the page goes to Google and comes back, because phone browsers handle popups badly). If Clerk ever needs a full page it uses `/sign-in` and `/sign-up` on your own address (the settings are in `apps/studio/src/lib/ClerkBridge.tsx` and `CLERK_ROUTES` in `config.ts`; `public/_redirects` makes those two addresses open the app). In the Clerk dashboard, under Configure, Paths, you can also set the sign-in and sign-up URLs to those same two pages.
- **An email did not arrive**: check spam first; check `https://YOUR-SITE/api/mail/status`; look at the Brevo dashboard, Transactional, Logs; on the Share screen a failed email shows the reason.
- **Reminders and scheduled emails never go out**: the scheduler is not running or its secret differs (see "The scheduler").
- **The Support button shows an old UPI ID**: the ID is baked in when the site is built. (1) Check which file sets it: in `apps\studio` run `Get-ChildItem -Force -Filter ".env*"`; Vite reads `.env`, `.env.local`, `.env.production` and `.env.production.local`, and a later one wins. (2) A PowerShell variable beats every file: `$env:VITE_SUPPORT_UPI` must print nothing (clear it with `Remove-Item Env:VITE_SUPPORT_UPI`). (3) Rebuild and check the result before deploying: `pnpm build`, then `Get-ChildItem dist\assets\*.js | Where-Object { Select-String -Path $_.FullName -Pattern "@oldbank" -Quiet }` lists nothing once the old ID is gone. (4) Open the **main** address in a private window. Every deploy also keeps its own one-off address (`https://1a2b3c4d.madeforyou-xxxx.pages.dev`) frozen on the build it was made from, so an old link keeps showing the old ID. To remove those: Cloudflare dashboard, Workers & Pages, madeforyou, Deployments, delete the old ones.
- **The Support button is missing**: `VITE_SUPPORT_UPI` is empty or not a valid UPI ID, or the site was not rebuilt after you set it.

## For developers

- **Adding a block**: define it in `packages/schema/src/blocks.ts` and register it in `registry.ts`; add a component in `packages/renderer/src/blocks.tsx` or `more.tsx` (and its table); add a description in `apps/studio/src/editor/blockInfo.ts`. Field tags (`personal`, `guided`, `required`, `prompt`, `placeholder`) drive guided mode, template stripping and the publish check automatically.
- **Editing rule**: never assign `block.fields` directly. Use `setField()`: it clears the placeholder flag and drops stale translations of that field.
- **Store selectors** must return a stable value. Select `s.pages`, then derive lists with `useMemo`; a selector that builds a new array each call re-renders forever.
- **The server never trusts the browser**: it validates everything again. Locked, ended and password states return no content at all. Photos are served only to their owner or to a visitor holding a short-lived token earned by passing the page's gates.
- **Link previews**: `/p/<link>` is rendered by `functions/p/[slug].ts`, which fills in the WhatsApp card. Locked, private and password pages show a generic card.
- **Database changes** are numbered files in `packages/api/migrations/`; `cf:deploy` applies them. Never edit an old one: add the next number.
- **Links** are stored only as https, http, mailto or tel; videos only as provider + id. YouTube loads only when tapped.
- **Spam protection on guest forms** works without any service: the guest must have opened the page, a hidden field catches bots, forms filled in under 1.5 seconds are refused, 5 messages per visitor per 10 minutes, 40 per page per hour, 400 per page. Turnstile (above) adds a stronger check on top.
- **Tests**: `pnpm test` runs 450 tests across schema, templates, renderer, api and studio. The studio tests run the real server in-process, so they cover whole journeys (publish, report, delete account, support).

## Not done yet

- Real-phone testing across Android and iPhone Safari (voice notes, crop dragging, story picture, the three themes' fonts).
- Clerk production mode and a domain (Clerk production needs a domain you own). Until then Clerk runs in development mode, which is fine for a small beta.
- Fonts load from Google Fonts; self-host them for a faster, more private production site.
- The Content-Security-Policy in `apps/studio/public/_headers` is report-only. Check the browser console on the live site, then rename it to `Content-Security-Policy` to enforce it.
- Renderer UI words (countdown labels, form labels) are in `packages/renderer/src/labels.ts`; text a user writes has no Hindi version unless they add one.
- Only the envelope opening is fully designed (gift box, curtain and diary fall back to it).
