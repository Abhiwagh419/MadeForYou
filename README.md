# MadeForYou

Free, no-code personal tribute pages. Pick a template, answer a few questions, add photos and a voice note, and send the page to someone you love as a link, a WhatsApp card, a QR code or a story picture. India-first, mobile-first, English and Hindi.

The product name, the operator and the contact email live in one place: `packages/ui/src/brand.ts`.

## Contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Architecture](#architecture)
4. [Repository structure](#repository-structure)
5. [Prerequisites and installation](#prerequisites-and-installation)
6. [Local development](#local-development)
7. [Configuration reference](#configuration-reference)
8. [Database setup and migrations](#database-setup-and-migrations)
9. [Authentication (Clerk)](#authentication-clerk)
10. [Email (Brevo) and the scheduler](#email-brevo-and-the-scheduler)
11. [Spam check (Turnstile)](#spam-check-turnstile)
12. [Testing, checks and builds](#testing-checks-and-builds)
13. [Deployment](#deployment)
14. [Running the site](#running-the-site)
15. [Security](#security)
16. [Known limitations](#known-limitations)
17. [Troubleshooting](#troubleshooting)
18. [Developer notes](#developer-notes)

## Features

- **26 blocks**: hero, featured photo, gallery, timeline, days together, video, text, letter, quote or shayari, reasons list, promises or bucket list, open-when letters, countdown, scratch card, the ask, quiz, memory match, event details (with add to calendar), buttons and links, divider, signature, voice note, place on a map, wishes wall, reply box, RSVP.
- **19 launch templates** and **3 themes** (Rose garden, Marigold sun, Midnight stars). Guided mode asks a few questions; an editor with a phone preview is there for everything else.
- **Photos you crop yourself**: choose the part to show and the page shows exactly your crop. The cover frame and the memory cards keep the theme's shape and lock the crop box to it.
- **Publish and share**: link, WhatsApp card, QR code, a 1080 x 1920 story picture, password, an "opens on" lock, an end date, private mode.
- **Guest messages**: wishes (with approval), replies and RSVPs, read in an inbox. A friend can add a wish through an invite link without seeing the page.
- **Email** (optional, free): send a page to someone on a date, one reminder to guests before an event, and "this page ends soon".
- **Safety**: Terms and Privacy pages, "Report this page", a review page for the site owner, takedowns, and "Delete my account and all my data".
- **Support us** (optional): a quiet page where people can give any amount by UPI.
- **Reliability and access**: a crash in any screen shows a calm message instead of a blank page; popups keep keyboard focus; creator screens load on demand so a shared page opens quickly.

## Technology stack

| Area | Choice |
|---|---|
| Language | TypeScript 5 (strict, plus no unused code), pnpm 9 workspaces, Node 20 or newer |
| Website | React 19, Vite 7, a small hash router |
| Server | Hono 4 on Cloudflare Pages Functions, validation with Zod 4 |
| Data | Cloudflare D1 (SQLite). Photos live in D1 by default; Cloudflare R2 is optional |
| Sign-in | Clerk (`@clerk/clerk-react`) |
| Email | Brevo transactional API (free plan), sent by a scheduled Cloudflare Worker |
| Spam check | Cloudflare Turnstile (optional) |
| Tests | Vitest 3 and jsdom. The server is tested against a SQLite database built from the real migration files |
| Hosting | Cloudflare Pages, Wrangler 4 |

## Architecture

```
  Visitor or creator (browser)
        |
        |  static site + /p/<link> link-preview page
        v
  Cloudflare Pages ------------------------------------------+
    apps/studio (React app)                                   |
    functions/p/[slug].ts   fills in the WhatsApp card        |
    functions/api/[[route]].ts  -->  packages/api (Hono)  ----+--> D1 database (pages, photos, messages, ...)
                                          |                   |--> Clerk (verifies logins, looks up an owner's email)
                                          |                   |--> Brevo (sends email)
                                          |                   +--> Turnstile (checks guest forms)
                                          ^
  workers/mailer  --every 15 minutes-->  POST /api/cron/tick  (sends due email, cleans up old data)
```

- A page is JSON. `packages/schema` defines and validates it; `packages/renderer` turns it into the page and never imports the editor.
- The **server never trusts the browser**. It validates everything again, evaluates locks, end dates and passwords itself, and sends no content at all for a page that is locked, ended, private or password-protected until the visitor passes the gate.
- Photos are served only to their owner, or to a visitor holding a short-lived signed pass earned by opening the page. The pass is checked against the page's **current** state on every request, so a page that has ended, been re-locked or made private stops serving photos at once.
- With no account the website runs entirely in the browser (**local mode**): nothing is sent anywhere. With `VITE_REMOTE=1` it runs in **live mode** against the server.

## Repository structure

| Path | What it is |
|---|---|
| `packages/schema` | The 26-block registry, Zod validation, template stripping, guided questions, the publish check, guest-message cleaning, email check, limits |
| `packages/renderer` | JSON to page. Imports the schema as types only |
| `packages/templates` | The launch templates as JSON, validated when loaded |
| `packages/ui` | Brand constants and theme tokens |
| `packages/api` | The server (plain TypeScript, no Cloudflare imports): pages, photos, guest messages, email, reports, account deletion, the scheduled job. Holds `migrations/` |
| `apps/studio` | The website and the Pages Functions that wrap the API (`functions/`), the deploy scripts (`scripts/`) and the security headers (`public/_headers`) |
| `apps/preview` | A phone-frame harness for working on templates (`pnpm renderer-lab`) |
| `workers/mailer` | The scheduler Worker (`index.js`, `wrangler.toml`) |
| `.github/workflows/ci.yml` | Typecheck, tests and build on every push; migrations and deploy on `main` |

## Prerequisites and installation

You need Node 20 or newer and pnpm 9.

```
npm i -g pnpm@9
pnpm install
```

For live mode and deployment you also need free accounts with Cloudflare, Clerk and (for email) Brevo. No payment card is needed for any of them.

## Local development

```
pnpm studio        # the website on http://localhost:5173, in local mode
pnpm test          # every test
pnpm typecheck     # types, plus unused-code checks
pnpm renderer-lab  # the template preview harness
```

**Local mode** keeps pages and photos in the browser. There is no server, no login and no email, and a share link opens only on the same computer. It is the quickest way to work on design.

**Live mode on your own computer** (the real server, a fake login, a local database):

```
cd apps/studio
copy .dev.vars.example .dev.vars          # PowerShell. On macOS or Linux: cp
pnpm exec wrangler d1 migrations apply madeforyou --local
$env:VITE_REMOTE="1"; pnpm run cf:dev     # PowerShell. On macOS or Linux: VITE_REMOTE=1 pnpm run cf:dev
```

`.dev.vars.example` sets `ALLOW_DEV_AUTH=1`, which lets a visitor sign in with any name and no password. **Never set `ALLOW_DEV_AUTH` on a real deployment.** Leave `VITE_CLERK_PUBLISHABLE_KEY` unset for this mode.

## Configuration reference

### Secrets for the server

Set each one with `pnpm exec wrangler pages secret put NAME --project-name madeforyou` (run in `apps/studio`; you paste the value when asked), then deploy again, because secrets only reach a new deployment.

| Secret | Needed | What it is |
|---|---|---|
| `SESSION_SECRET` | yes | At least 24 random characters (the site's status page warns if it is shorter). Signs the photo and gate passes, invite and unsubscribe links, and is mixed into page-password hashes and visitor-address hashes. **Changing it later invalidates page passwords, invite links and unsubscribe links already sent.** |
| `CLERK_ISSUER` | yes | Your Clerk Frontend API URL. `CLERK_JWKS_URL` is derived from it if you leave that out |
| `CLERK_JWKS_URL` | optional | The Frontend API URL plus `/.well-known/jwks.json` |
| `ADMIN_TOKEN` | yes | A long random text. Opens the review page `#/admin`. Wrong guesses are limited to 10 per 10 minutes per visitor |
| `BREVO_API_KEY` | for email | Brevo, Settings, SMTP and API, API keys |
| `MAIL_FROM` | for email | An address verified in Brevo (Settings, Senders) |
| `MAIL_FROM_NAME` | optional | The sender name. Default: MadeForYou |
| `CRON_SECRET` | for email and clean-up | A long random text, also given to the scheduler (below) |
| `CLERK_SECRET_KEY` | optional | Lets the server find an owner's email for "ends soon", and remove the Clerk login when an account is deleted |
| `REPORT_EMAIL` | optional | Where "page reported" notes go. Default: `MAIL_FROM` |
| `PUBLIC_URL` | recommended | Your main address, such as `https://madeforyou-9pj.pages.dev`. Used in email links so they never show a one-off deploy address |
| `TURNSTILE_SECRET` | optional | The Turnstile secret key. Set it together with `VITE_TURNSTILE_SITE_KEY` |
| `ALLOWED_ORIGIN` | optional | One extra origin allowed to call the API (only if the website is served from a different address) |
| `ALLOW_DEV_AUTH` | never in production | See Local development |

### Build settings for the website

These go in `apps/studio/.env.production`, which is not committed (git ignores `.env.*`). Vite reads it when building.

```
VITE_REMOTE=1
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPPORT_UPI=yourname@yourbank
VITE_TURNSTILE_SITE_KEY=0x4AAAA...
```

| Setting | Needed | What it is |
|---|---|---|
| `VITE_REMOTE` | yes | `1` makes the build talk to the server. Without it the site runs in local mode and saves nothing for anyone. `pnpm run cf:deploy` refuses to deploy without it |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Your Clerk publishable key |
| `VITE_SUPPORT_UPI` | optional | Your UPI ID. Switches on the "Support us" page. A UPI ID that is just a mobile number is refused, so a phone number never ends up on a public page |
| `VITE_TURNSTILE_SITE_KEY` | optional | The public Turnstile site key |
| `VITE_API_URL` | optional | Only if the API lives at a different address from the website |

With GitHub Actions, set `VITE_CLERK_PUBLISHABLE_KEY` as a repository secret and `VITE_SUPPORT_UPI` and `VITE_TURNSTILE_SITE_KEY` as repository variables.

## Database setup and migrations

The schema is the numbered files in `packages/api/migrations/`, applied in order by Wrangler. Never edit an old one: add the next number.

| File | Adds |
|---|---|
| `0001_init.sql` | users, pages, assets, page_assets, templates, throttle |
| `0002_asset_blobs.sql` | photos stored in the database |
| `0003_submissions.sql` | guest wishes, replies and RSVPs |
| `0004_mail.sql` | deliveries, mail_log, mail_blocks, owner email, reminder columns |
| `0005_safety.sql` | reports, takedown columns |

First time:

```
cd apps/studio
pnpm exec wrangler login
pnpm exec wrangler d1 create madeforyou
```

You do not have to copy the database id: `pnpm run cf:deploy` looks it up and writes `wrangler.toml` for you. `cf:deploy` also applies any new migrations. To apply them by hand: `pnpm exec wrangler d1 migrations apply madeforyou --remote` (use `--local` for the local copy). To look inside, always add `--remote`, or Wrangler reads an empty local database:

```
pnpm exec wrangler d1 execute madeforyou --remote --command "SELECT id, status, slug FROM pages LIMIT 10"
```

The tests build their database from these same files, so a migration that does not apply fails the tests.

**Photos** are stored in D1 by default (25 MB per person, 1.5 MB per photo, 30 pages per person; the free database holds 500 MB in total). To use R2 instead, create a bucket and uncomment the `r2_buckets` lines in `wrangler.toml`; Cloudflare asks for a card to enable R2.

**Back up** with `pnpm exec wrangler d1 export madeforyou --remote --output backup.sql`. Photos are inside the database, so this covers them too.

## Authentication (Clerk)

1. At dashboard.clerk.com create an application and enable the sign-in methods you want (email and Google work out of the box).
2. Copy the **Publishable key** into `VITE_CLERK_PUBLISHABLE_KEY` and the **Frontend API URL** into the `CLERK_ISSUER` secret.
3. Sign in uses a popup on the page. Google opens in a small window on computers; on phones the page goes to Google and comes back, because phone browsers handle popups badly. If Clerk needs a full page it uses `/sign-in` and `/sign-up` on your own address (settings in `apps/studio/src/lib/ClerkBridge.tsx` and `CLERK_ROUTES` in `config.ts`; Cloudflare Pages opens the app for any address it has no file for, so these need no extra rule). In the Clerk dashboard, under Configure, Paths, you can set the sign-in and sign-up URLs to the same two pages.
4. The server verifies every login against Clerk's published keys, and gives each person only their own data. `#/status` shows whether the server accepts your login and which Clerk address it expects.

Clerk's development instances show a "Development mode" label and are meant for testing. Moving to a production instance needs a domain you own.

## Email (Brevo) and the scheduler

Email is off until `BREVO_API_KEY` and `MAIL_FROM` are set. Reminders and clean-up also need the scheduler.

1. At brevo.com create a free account (300 emails a day, no card), add and verify a sender address, and create an API key.
2. Set `BREVO_API_KEY` and `MAIL_FROM` (and, if you like, `MAIL_FROM_NAME`, `REPORT_EMAIL`, `PUBLIC_URL`, `CLERK_SECRET_KEY`).
3. Deploy the scheduler once. Cloudflare Pages cannot run on a timer, so `workers/mailer` wakes every 15 minutes and calls `/api/cron/tick`:

```
cd apps/studio
pnpm run mailer:secret     # paste the same CRON_SECRET you set on the site; answer Y if it offers to create the Worker
pnpm run mailer:deploy
```

Check `TICK_URL` in `workers/mailer/wrangler.toml` first (your main address plus `/api/cron/tick`). In the Cloudflare dashboard, Workers and Pages, `madeforyou-mailer`, Logs, you should see `tick 200` (`401` means the two `CRON_SECRET` values differ; `503` means the site has none or was not redeployed). `https://YOUR-SITE/api/mail/status` shows whether email and reminders are on.

**What is sent**

1. A page emailed to someone, now or on a date you choose (Share screen). Up to 5 people per page and 10 emails a day per owner.
2. One reminder for guests who left an email on the RSVP, a day before the event. The address is asked for only for that, and only from guests who said yes or maybe. It stays with the guest's reply, which the page's owner can see, until the reply, the page or the account is deleted.
3. "This page ends soon", a day before a page's end date, to the owner (needs `CLERK_SECRET_KEY`) and to people the page was emailed to.

**How it stays safe.** Every email has a stop link that opens a confirmation page, so mail scanners cannot trigger it; a stopped address is never emailed again by anyone. A delivery is marked in the log *before* it is sent, so two overlapping runs, or a server that stops half-way, can never send a second copy (a delivery whose outcome is unknown is shown as failed with an explanation, rather than being sent again). The daily total is held under 280. The same scheduled run also removes pages deleted more than 30 days ago, photos no page uses, handled reports older than a year, sent-email records older than 90 days and visitor-limit counters older than a day.

Without a domain of your own, mail goes out from your verified address through Brevo, and mail from a Gmail-style address can land in spam. A domain you own fixes that.

## Spam check (Turnstile)

Wishes, replies, RSVPs, invite-link wishes and "Report this page" can be protected by Cloudflare Turnstile. It is almost always invisible; it shows a tick box only when Cloudflare is unsure, and says "We could not confirm you are a person" if the check fails.

1. Cloudflare dashboard, **Turnstile**, **Add widget**. Add your site's hostname and choose **Managed**.
2. Put the **site key** in `apps/studio/.env.production` as `VITE_TURNSTILE_SITE_KEY`.
3. Set the **secret key**: `pnpm exec wrangler pages secret put TURNSTILE_SECRET --project-name madeforyou`.
4. `pnpm run cf:deploy`, then post a test wish from a private window.

Set the site key and the secret in the same deploy: the server starts demanding the check as soon as it has the secret. To switch it off, delete the secret and deploy again. Visitors whose ad blocker blocks `challenges.cloudflare.com` cannot post. Without Turnstile the forms are still protected by a hidden field, a minimum fill time and per-visitor, per-page and per-address limits.

## Testing, checks and builds

```
pnpm test           # 478 tests across five packages
pnpm typecheck      # TypeScript strict mode, plus unused variables, imports and parameters
pnpm --filter @madeforyou/studio build      # a local-mode build
```

For a live build: `VITE_REMOTE=1 pnpm --filter @madeforyou/studio build` (PowerShell: `$env:VITE_REMOTE="1"`).

| Package | Tests | What they cover |
|---|---|---|
| `schema` | 43 | validation, templates, guest-message cleaning, email checks |
| `templates` | 93 | every template validates, search |
| `renderer` | 104 | every block, forms, locks |
| `api` | 140 | the whole server: gates, photos, publishing, guest messages, email, reports, deletion, limits, clean-up |
| `studio` | 98 | whole journeys through the real server in-process (publish, report, delete account, support, spam check), popups and crash handling, deploy helpers |

There is no separate linter or formatter. `pnpm typecheck` includes the compiler's unused-code checks, which is what keeps dead code out. Check the dependencies with `pnpm audit --prod` (the code that runs on the site) and `pnpm audit` (adds the build and test tools).

## Deployment

**By hand** (the usual way), in `apps/studio`:

```
pnpm exec wrangler pages project create madeforyou --production-branch main     # once
pnpm run cf:deploy
```

`cf:deploy` finds your database id, checks that `VITE_REMOTE=1` is set, applies new migrations, builds and deploys to the production branch. It does not run the tests, so run `pnpm test` first. Afterwards open `https://YOUR-SITE/api/health` (it should show `{"ok":true}`) and `https://YOUR-SITE/#/status`. Use the main address, not the one-off address with a random prefix.

**With GitHub Actions** (`.github/workflows/ci.yml`): every push runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test` and a live build. A push to `main` then applies the database migrations and deploys. Add the repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `VITE_CLERK_PUBLISHABLE_KEY` (and the variables `VITE_SUPPORT_UPI`, `VITE_TURNSTILE_SITE_KEY`). The scheduler Worker is deployed by hand (`pnpm run mailer:deploy`).

**After changing code or a lockfile**, run `pnpm install` before `pnpm test` and `cf:deploy`.

## Running the site

- **Your review page**: `#/admin`, with your `ADMIN_TOKEN`. Open a reported page, dismiss the report, take the page down (its owner cannot publish it again) or restore it. It also shows how many people, pages and photos there are, and how full the database is. The same numbers: `GET /api/admin/usage` with the header `x-admin-token`.
- **Public templates** made by users go through you: `GET /api/admin/templates/pending`, then `POST /api/admin/templates/<id>/approve` or `reject`. A rejected template stays rejected when its owner saves it again.
- **Reports** arrive by email (if email is on) and wait in the review page.
- **Weekly**: take a backup (see Database setup).
- **Updating**: copy the new files over the project, `pnpm install`, `pnpm test`, `pnpm run cf:deploy`.
- **Terms and Privacy** are the pages `#/terms` and `#/privacy`; the words are in `apps/studio/src/lib/legal.ts`. **If you change what the app stores or which companies handle data, change the Privacy page too.**

## Security

- **Sign-in and ownership.** Every route that changes data requires a verified login and checks that the page, photo, template, message or delivery belongs to that person. These checks are covered by tests.
- **Locks are enforced on the server.** Locked, ended, private and password pages return no content. A visitor's photo pass lasts 6 hours but is re-checked against the page's current state, and a taken-down page serves nothing.
- **Page passwords** are stored as a keyed hash (HMAC-SHA256 with the server secret and a per-page salt), never in the clear, and guessing is limited to 8 tries per visitor per page per 10 minutes. This is not a slow hash, so tell people to choose long passwords.
- **Request limits** are enforced on the bytes that actually arrive, not on the `Content-Length` header: 400 KB of JSON, 1.5 MB per photo, 25 MB and 30 pages per person.
- **Uploads** are accepted only if their first bytes really are JPEG, PNG, WebP or one of the audio formats (WebM, MP4, Ogg, MP3). SVG is never accepted. Photos are served with `nosniff`.
- **Spam and abuse limits** on guest forms, reports, uploads, password attempts, admin guesses and email (see above).
- **Privacy.** Visitor addresses are kept only as a hash. Deleting an account removes the person's data at once; deleted pages go after 30 days; the Privacy page says the same.
- **Headers.** `nosniff`, no framing, a strict referrer policy and a permissions policy on every page; shared pages and invite links carry `noindex`. The stop-emails page has its own strict content-security policy.
- **Content-Security-Policy is in report-only mode** (`apps/studio/public/_headers`). The pages that can be tested without Clerk, Turnstile and Google Fonts load with no reports. Before enforcing it, open the sign-in popup and a page with a guest form on the live site with the browser console open, look for "Content-Security-Policy-Report-Only" messages, fix the policy for anything legitimate, and then rename the header to `Content-Security-Policy`.
- **Dependencies.** At the final review there were no known vulnerabilities in the code that runs on the site. The remaining advisories are in the test runner (`vitest` 3 and its `tinypool`), which only runs on a developer's machine; moving to vitest 4 needs the studio tests' use of Node's built-in SQLite to be reworked.
- **Secrets** are never committed (`.env.*` and `.dev.vars` are ignored). If one leaks, set a new value and deploy again.

## Known limitations

- **Free-tier limits.** The free D1 database holds 500 MB in total; Brevo's free plan allows 300 emails a day (the site stops at 280); Workers have a limited CPU time per run. The review page shows how full the database is.
- **One scheduled job.** Email and clean-up depend on the scheduler Worker running. If it stops, scheduled emails and reminders wait (and are not lost) until it runs again.
- **Page passwords** use a keyed hash rather than a deliberately slow one (see Security). **Changing `SESSION_SECRET`** invalidates page passwords, invite links and unsubscribe links.
- **Clerk development mode** until you have a domain; the sign-in box shows a "Development mode" label.
- **Email from a personal address** can land in spam. A domain you own improves this.
- **No account suspension.** The review page can take a page down, but there is no switch to block a person; a taken-down page's owner could make a new one.
- **Third parties.** Fonts load from Google Fonts, and embedded YouTube, Vimeo, Spotify and OpenStreetMap items connect to those companies when loaded (the Privacy page says so). Self-hosting the fonts would be faster and more private.
- **Not yet verified by me on live services.** Clerk sign-in, Turnstile, Brevo delivery and the scheduled job depend on your accounts. They are covered by tests that stand in for those services, and by the checks on `#/status`, `/api/mail/status` and the scheduler logs described above, but they can only be fully confirmed on your live site.
- **Openings.** Only the envelope opening is fully designed; the gift box, curtain and diary fall back to it.
- **Words on the page.** Text a person writes has no Hindi version unless they add one; the fixed interface words are in `packages/renderer/src/labels.ts`.
- **Tooling.** No separate linter or formatter is configured.

## Troubleshooting

- **Sign-in works but saving says "please sign in"**: the site shows a banner explaining why (it calls `/api/diag`). Usually `CLERK_ISSUER` or `CLERK_JWKS_URL` belongs to a different Clerk application than the publishable key, or a secret was set after the last deploy. Run `pnpm run cf:deploy` again. Stray spaces, newlines and trailing slashes are ignored.
- **"database_id" error when deploying**: `wrangler.toml` must hold the 36-character id of your database (not a URL). `pnpm run cf:deploy` fills it in; by hand, `pnpm exec wrangler d1 list` prints it.
- **Deploy stops with "would NOT be connected to the server"**: add `VITE_REMOTE=1` to `apps/studio/.env.production`.
- **Sign-in sends people to a Clerk page (`accounts.dev`)**: see Authentication. The popup, the Google window and the `/sign-in` and `/sign-up` pages are all meant to stay on your site.
- **The status page shows a red "Signing secret" line**: `SESSION_SECRET` is shorter than 24 characters. Set a long random one and deploy again (see the warning about passwords and links above).
- **An email did not arrive**: check spam; check `https://YOUR-SITE/api/mail/status`; look at the Brevo dashboard, Transactional, Logs; on the Share screen a failed email shows the reason.
- **Reminders and scheduled emails never go out**: the scheduler is not running or its secret differs (see the scheduler section).
- **The Support button is missing**: `VITE_SUPPORT_UPI` is empty, is not a valid UPI ID, is a phone number, or the site was not rebuilt after you set it.
- **Guests are refused with "We could not confirm you are a person"**: the Turnstile widget's hostname list does not match your address, or an ad blocker is blocking Cloudflare's script.
- **A test fails only on a slow computer**: the tests wait for results rather than for a fixed time; if one still fails, run it alone (`pnpm exec vitest run test/<file>` in the package) and look at the message.

## Developer notes

- **Adding a block**: define it in `packages/schema/src/blocks.ts` and register it in `registry.ts`; add a component in `packages/renderer/src/blocks.tsx` or `more.tsx` (and its table); add a description in `apps/studio/src/editor/blockInfo.ts`. Field tags (`personal`, `guided`, `required`, `prompt`, `placeholder`) drive guided mode, template stripping and the publish check automatically.
- **Editing rule**: never assign `block.fields` directly. Use `setField()`: it clears the placeholder flag and drops stale translations of that field.
- **Store selectors** must return a stable value. Select `s.pages`, then derive lists with `useMemo`; a selector that builds a new array each call re-renders forever.
- **Screens** other than the page viewer and the invite page are loaded on demand (`apps/studio/src/App.tsx`). Tests call `preloadScreens()` first so each screen appears immediately.
- **Link previews**: `/p/<link>` is rendered by `functions/p/[slug].ts`, which fills in the WhatsApp card. Locked, private and password pages show a generic card.
- **Links** are stored only as https, http, mailto or tel; videos only as provider and id; YouTube loads only when tapped.
- **The server has no Cloudflare imports**, so it runs and is tested against a D1-shaped SQLite. New routes go in `packages/api/src/app.ts` with a test beside the existing ones.
