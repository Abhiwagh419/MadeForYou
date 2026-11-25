# MadeForYou

A free website for making a personal tribute page for someone you love. You pick a template, answer a few questions, add photos and a voice note, and share the page as a link, a WhatsApp card, a QR code or a story picture. It is made for India first: phone-first, English and Hindi.

The product name, the operator name and the contact email are all in one file: `packages/ui/src/brand.ts`.

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [How it fits together](#how-it-fits-together)
4. [Folder structure](#folder-structure)
5. [Setup](#setup)
6. [Running it locally](#running-it-locally)
7. [Configuration](#configuration)
8. [Database](#database)
9. [Login (Clerk)](#login-clerk)
10. [Email (Brevo) and the scheduler](#email-brevo-and-the-scheduler)
11. [Spam check (Turnstile)](#spam-check-turnstile)
12. [Tests and builds](#tests-and-builds)
13. [Deploying](#deploying)
14. [Running the site](#running-the-site)
15. [Security](#security)
16. [Known limitations](#known-limitations)
17. [Troubleshooting](#troubleshooting)
18. [Notes for developers](#notes-for-developers)

## Features

- 26 blocks: hero, featured photo, gallery, timeline, days together, video, text, letter, quote or shayari, reasons list, promises or bucket list, open-when letters, countdown, scratch card, the ask, quiz, memory match, event details (with add to calendar), buttons and links, divider, signature, voice note, map, wishes wall, reply box and RSVP.
- 76 templates (festivals, life events and a trending set inspired by Instagram formats) and 3 themes (Rose garden, Marigold sun, Midnight stars). Guided mode asks a few questions, and the editor (with a phone preview) is there for everything else.
- Photo cropping: the person picks the part of the photo to show and the page shows exactly that crop.
- Sharing: link, WhatsApp card, QR code, a 1080 x 1920 story picture, a password, an "opens on" date, an end date and a private mode.
- Guest messages: wishes (the owner approves them), replies and RSVPs, which the owner reads in an inbox. A friend can add a wish through an invite link without seeing the page.
- Email (optional, free): send a page to someone on a date, one reminder to guests before an event, and a "this page ends soon" mail.
- Safety: Terms and Privacy pages, "Report this page", a review page for the site owner, takedowns, and "Delete my account and all my data".
- Support page (optional): people can give any amount by UPI.
- If a screen crashes it shows an error message instead of a blank page, popups keep keyboard focus, and the creator screens load only when needed so a shared page opens fast.

## Tech stack

| Area | What I used |
|---|---|
| Language | TypeScript 5 (strict, with unused code checks), pnpm 9 workspaces, Node 22 or newer |
| Website | React 19, Vite 7, a small hash router |
| Server | Hono 4 on Cloudflare Pages Functions, Zod 4 for validation |
| Data | Cloudflare D1 (SQLite). Photos are stored in D1 by default, R2 is optional |
| Login | Clerk (`@clerk/clerk-react`) |
| Email | Brevo transactional API (free plan), sent from a scheduled Cloudflare Worker |
| Spam check | Cloudflare Turnstile (optional) |
| Tests | Vitest 3 and jsdom. The server tests run against a SQLite database built from the real migration files |
| Hosting | Cloudflare Pages, Wrangler 4 |

Node 22 is needed because the test helper in `packages/api/src/testing.ts` uses the built-in `node:sqlite` module. Node 20 will not run the tests.

## How it fits together

```
  Visitor or creator (browser)
        |
        |  static site + /p/<link> link-preview page
        v
  Cloudflare Pages ------------------------------------------+
    apps/studio (React app)                                   |
    functions/p/[slug].ts   fills in the WhatsApp card        |
    functions/api/[[route]].ts  -->  packages/api (Hono)  ----+--> D1 database
                                          |                   |--> Clerk (checks logins, finds an owner's email)
                                          |                   |--> Brevo (sends email)
                                          |                   +--> Turnstile (checks guest forms)
                                          ^
  workers/mailer  --every 15 minutes-->  POST /api/cron/tick  (sends due email, cleans up old data)
```

- A page is a JSON document. `packages/schema` defines and validates it, and `packages/renderer` turns it into the page. The renderer never imports the editor.
- The server does not trust the browser. It validates everything again and works out locks, end dates and passwords itself. A page that is locked, ended, private or password protected sends no content until the visitor gets past the gate.
- Photos are served only to their owner, or to a visitor with a signed pass that lasts 6 hours. The pass is checked against the page's current state on every request, so a page that has ended, been re-locked or made private stops serving photos straight away.
- With no account the site runs entirely in the browser (local mode) and nothing is sent anywhere. With `VITE_REMOTE=1` it runs in live mode and talks to the server.

## Folder structure

| Path | What it is |
|---|---|
| `packages/schema` | Block registry, Zod validation, template stripping, guided questions, publish check, guest message cleaning, email check, limits |
| `packages/renderer` | Turns page JSON into the page. Imports the schema as types only |
| `packages/templates` | The 76 templates, validated when loaded |
| `packages/ui` | Brand constants and theme tokens |
| `packages/api` | The server, plain TypeScript with no Cloudflare imports: pages, photos, guest messages, email, reports, account deletion and the scheduled job. Holds `migrations/` |
| `apps/studio` | The website, the Pages Functions that wrap the API (`functions/`), the deploy scripts (`scripts/`) and the security headers (`public/_headers`) |
| `apps/preview` | A phone-frame page for working on templates (`pnpm renderer-lab`) |
| `workers/mailer` | The scheduler Worker (`index.js`, `wrangler.toml`) |
| `.github/workflows/ci.yml` | Typecheck, tests and build on every push, then migrations and deploy on `main` |

## Setup

You need Node 22 or newer and pnpm 9.

```
npm i -g pnpm@9
pnpm install
```

For live mode and deploying you also need free accounts on Cloudflare, Clerk and (for email) Brevo. None of them ask for a card.

## Running it locally

```
pnpm studio        # the website on http://localhost:5173, in local mode
pnpm test          # all tests
pnpm typecheck     # types and unused code checks
pnpm renderer-lab  # the template preview page
```

Local mode keeps pages and photos in the browser. There is no server, no login and no email, and a share link only opens on the same computer. It is the quickest way to work on the design.

To run live mode on your own computer (the real server, a fake login and a local database):

```
cd apps/studio
copy .dev.vars.example .dev.vars          # PowerShell. On macOS or Linux use cp
pnpm exec wrangler d1 migrations apply madeforyou --local
$env:VITE_REMOTE="1"; pnpm run cf:dev     # PowerShell. On macOS or Linux: VITE_REMOTE=1 pnpm run cf:dev
```

`.dev.vars.example` sets `ALLOW_DEV_AUTH=1`, which lets anyone sign in with any name and no password. Never set it on the real site. Leave `VITE_CLERK_PUBLISHABLE_KEY` empty in this mode.

## Configuration

### Server secrets

Set each one from `apps/studio` with `pnpm exec wrangler pages secret put NAME --project-name madeforyou` and paste the value when asked. Then deploy again, because a secret only reaches a new deployment.

| Secret | Needed | What it is |
|---|---|---|
| `SESSION_SECRET` | yes | At least 24 random characters (the status page warns if it is shorter). It signs the photo and gate passes, the invite links and the unsubscribe links, and it is mixed into page password hashes and visitor address hashes. **Changing it later breaks existing page passwords, invite links and unsubscribe links.** |
| `CLERK_ISSUER` | yes | Your Clerk Frontend API URL. `CLERK_JWKS_URL` is worked out from it if you leave that out |
| `CLERK_JWKS_URL` | no | The Frontend API URL plus `/.well-known/jwks.json` |
| `ADMIN_TOKEN` | yes | A long random text. It opens the review page `#/admin`. Wrong guesses are limited to 10 per 10 minutes per visitor |
| `BREVO_API_KEY` | for email | Brevo, Settings, SMTP and API, API keys |
| `MAIL_FROM` | for email | An address you verified in Brevo (Settings, Senders) |
| `MAIL_FROM_NAME` | no | Sender name. Default: MadeForYou |
| `CRON_SECRET` | for email and clean-up | A long random text. The scheduler gets the same value (see below) |
| `CLERK_SECRET_KEY` | no | Lets the server find an owner's email (for "ends soon" and the report mails) and delete the Clerk login when an account is deleted |
| `REPORT_EMAIL` | no | Where "page reported" mails go, and the contact address shown in the report mails. Default: `MAIL_FROM` |
| `PUBLIC_URL` | recommended | Your main address, like `https://madeforyou-9pj.pages.dev`. Used in email links so they never show a one-off deploy address |
| `TURNSTILE_SECRET` | no | The Turnstile secret key. Set it together with `VITE_TURNSTILE_SITE_KEY` |
| `ALLOWED_ORIGIN` | no | One extra origin allowed to call the API (only if the website is on a different address) |
| `ALLOW_DEV_AUTH` | never in production | See "Running it locally" |

### Build settings for the website

These go in `apps/studio/.env.production`. Git ignores it (`.env.*`) and Vite reads it when building.

```
VITE_REMOTE=1
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPPORT_UPI=yourname@yourbank
VITE_TURNSTILE_SITE_KEY=0x4AAAA...
```

| Setting | Needed | What it is |
|---|---|---|
| `VITE_REMOTE` | yes | `1` makes the build talk to the server. Without it the site is in local mode and saves nothing for anyone. `pnpm run cf:deploy` refuses to deploy without it |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes | Your Clerk publishable key |
| `VITE_SUPPORT_UPI` | no | Your UPI ID. It turns on the support page, the support card and the help pop-up. A UPI ID that is only a mobile number is refused, so a phone number never ends up on a public page |
| `VITE_TURNSTILE_SITE_KEY` | no | The public Turnstile site key |
| `VITE_API_URL` | no | Only if the API is on a different address from the website |

With GitHub Actions, add `VITE_CLERK_PUBLISHABLE_KEY` as a repository secret, and `VITE_SUPPORT_UPI` and `VITE_TURNSTILE_SITE_KEY` as repository variables.

## Database

The schema is the numbered files in `packages/api/migrations/`, applied in order by Wrangler. Do not edit an old one, add the next number instead.

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

You do not need to copy the database id by hand. `pnpm run cf:deploy` looks it up and writes it into `wrangler.toml`, and it also applies new migrations. To apply them yourself: `pnpm exec wrangler d1 migrations apply madeforyou --remote` (`--local` for the local copy). To look inside the live database always add `--remote`, otherwise Wrangler reads an empty local one:

```
pnpm exec wrangler d1 execute madeforyou --remote --command "SELECT id, status, slug FROM pages LIMIT 10"
```

The tests build their database from these same files, so a migration that does not apply makes the tests fail.

Photos are stored in D1 by default. The limits are 25 MB per person, 1.5 MB per photo and 30 pages per person, and the free database holds 500 MB in total. To use R2 instead, create a bucket and uncomment the `r2_buckets` lines in `wrangler.toml` (Cloudflare asks for a card to turn R2 on).

Backup: `pnpm exec wrangler d1 export madeforyou --remote --output backup.sql`. Photos are in the database, so this includes them.

A weekly encrypted backup also runs from `.github/workflows/backup.yml` (Sundays, and on demand from the Actions tab). Add a `BACKUP_PASSPHRASE` secret first, keep the repository private because the backup holds user data, and download the file now and then to keep a copy outside GitHub. To restore: `openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in backup.sql.enc -out backup.sql`.

## Login (Clerk)

1. Create an application at dashboard.clerk.com and turn on the sign-in methods you want (email and Google work out of the box).
2. Put the Publishable key in `VITE_CLERK_PUBLISHABLE_KEY` and the Frontend API URL in the `CLERK_ISSUER` secret.
3. Sign-in opens a popup on the page. Google opens in a small window on computers, and on phones the page goes to Google and comes back, because phone browsers are bad at popups. If Clerk needs a full page it uses `/sign-in` and `/sign-up` on your own address (see `apps/studio/src/lib/ClerkBridge.tsx` and `CLERK_ROUTES` in `config.ts`). Cloudflare Pages opens the app for any address that has no file, so no extra redirect rule is needed. Do not add a `public/_redirects` rule that sends everything to `index.html`, because it would also catch `/sign-in` (a test checks this). You can also set the same two URLs in the Clerk dashboard under Configure, Paths.
4. The server checks every login against Clerk's public keys and gives each person only their own data. `#/status` shows whether the server accepts your login and which Clerk address it expects.

Clerk development instances show a "Development mode" label. Moving to a production instance needs a domain you own.

## Email (Brevo) and the scheduler

Email stays off until `BREVO_API_KEY` and `MAIL_FROM` are set. Reminders and clean-up also need the scheduler.

1. Make a free account at brevo.com (300 emails a day, no card), add and verify a sender address, and create an API key.
2. Set `BREVO_API_KEY` and `MAIL_FROM`, and if you want `MAIL_FROM_NAME`, `REPORT_EMAIL`, `PUBLIC_URL` and `CLERK_SECRET_KEY`.
3. Deploy the scheduler once. Cloudflare Pages cannot run on a timer, so `workers/mailer` wakes up every 15 minutes and calls `/api/cron/tick`:

```
cd apps/studio
pnpm run mailer:secret     # paste the same CRON_SECRET you set on the site
pnpm run mailer:deploy
```

First check `TICK_URL` in `workers/mailer/wrangler.toml` (your main address plus `/api/cron/tick`). In the Cloudflare dashboard, under Workers and Pages, `madeforyou-mailer`, Logs, you should see `tick 200`. `401` means the two `CRON_SECRET` values are different, and `503` means the site has none or was not deployed again. `https://YOUR-SITE/api/mail/status` shows whether email and reminders are on.

**What gets sent**

1. A page emailed to someone, now or on a date you choose (Share screen). Up to 5 people per page and 10 emails a day per owner.
2. One reminder a day before an event, for guests who left an email on the RSVP. The address is only asked for this, and only from guests who said yes or maybe. It is kept with the guest's reply, which the page owner can see, until the reply, the page or the account is deleted.
3. "This page ends soon", a day before a page's end date, to the owner (needs `CLERK_SECRET_KEY`) and to the people the page was emailed to.
4. Report mails. When a page is reported, its owner is told once, on the first open report, without the reporter's details (needs `CLERK_SECRET_KEY`). When you dismiss a report, that reporter (if they left an email address) and the owner are told. When you take a page down, every reporter with an email address and the owner are told. The reason you type on the review page goes into these mails and is saved with the takedown. These mails have no stop link because they are one-off notices, but an address that asked for no emails is skipped. A failed send never undoes your decision. `REPORT_EMAIL` is shown in them as the contact address.

**How it avoids double sends.** Every email has a stop link that opens a confirmation page first, so a mail scanner that opens links cannot unsubscribe anyone. Once an address has stopped it is never emailed again. A delivery is marked in the log before it is sent, so two overlapping runs, or a server that dies half way, never send a second copy (if the outcome is unknown it is shown as failed with an explanation instead of being sent again). The daily total is kept under 280. The same scheduled run also removes pages deleted more than 30 days ago, photos no page uses, handled reports older than a year, sent-email records older than 90 days and visitor-limit counters older than a day.

Without your own domain, mail goes out from your verified address through Brevo and can end up in spam if it is a Gmail-style address.

## Spam check (Turnstile)

Wishes, replies, RSVPs, invite-link wishes and "Report this page" can be protected with Cloudflare Turnstile. It is almost always invisible, shows a tick box only when Cloudflare is unsure, and says "We could not confirm you are a person" if the check fails.

1. In the Cloudflare dashboard open Turnstile, Add widget, add your site's hostname and choose Managed.
2. Put the site key in `apps/studio/.env.production` as `VITE_TURNSTILE_SITE_KEY`.
3. Set the secret key: `pnpm exec wrangler pages secret put TURNSTILE_SECRET --project-name madeforyou`.
4. Run `pnpm run cf:deploy`, then post a test wish from a private window.

Set the site key and the secret in the same deploy, because the server starts asking for the check as soon as it has the secret. To turn it off, delete the secret and deploy again. Visitors whose ad blocker blocks `challenges.cloudflare.com` cannot post. Without Turnstile the forms are still protected by a hidden field, a minimum fill time, and limits per visitor, per page and per address.

## Tests and builds

```
pnpm test           # 490 tests
pnpm typecheck      # strict TypeScript, plus unused variable, import and parameter checks
pnpm --filter @madeforyou/studio build      # local-mode build
```

For a live build: `VITE_REMOTE=1 pnpm --filter @madeforyou/studio build` (PowerShell: `$env:VITE_REMOTE="1"`).

| Package | Tests | What they cover |
|---|---|---|
| `schema` | 43 | validation, templates, guest message cleaning, email checks |
| `templates` | 92 | every template validates, search |
| `renderer` | 104 | every block, forms, locks |
| `api` | 145 | the whole server: gates, photos, publishing, guest messages, email, reports, deletion, limits, clean-up |
| `studio` | 106 | full journeys through the real server (publish, report, restore, delete account, support, spam check), popups, crash handling, deploy helpers |

There is no separate linter or formatter. `pnpm typecheck` already includes the compiler's unused code checks. Check dependencies with `pnpm audit --prod` (what runs on the site) and `pnpm audit` (also the build and test tools).

### Help pop-up and promos

When `VITE_SUPPORT_UPI` is set, a small "A small favour" pop-up says the site runs on limited resources and links to the support page. It opens after every publish, and after the story picture or QR code is downloaded (at most once a day per device). The rules are in `apps/studio/src/lib/helpNote.ts`. Pages people receive end with a "Made with MadeForYou" block with "Reply with a page" and "Create a page like this" links back to the site (the owner does not see it on their own page in live mode). The support card also shows on the home page, My pages and the Share screen. With no UPI ID set, none of the support prompts appear.

"Create a page like this" goes to the template list (`/#/templates`), not to the exact template, because the public page data does not include the template id.

## Deploying

By hand (the usual way), from `apps/studio`:

```
pnpm exec wrangler pages project create madeforyou --production-branch main     # once
pnpm run cf:deploy
```

`cf:deploy` finds your database id, checks that `VITE_REMOTE=1` is set, applies new migrations, builds, and deploys to the production branch. It does not run the tests, so run `pnpm test` first. Afterwards open `https://YOUR-SITE/api/health` (it should show `{"ok":true}`) and `https://YOUR-SITE/#/status`. Use the main address, not the one-off address with a random prefix.

With GitHub Actions (`.github/workflows/ci.yml`): every push runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test` and a live build. A push to `main` then applies the database migrations and deploys. Add the repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `VITE_CLERK_PUBLISHABLE_KEY`, and the variables `VITE_SUPPORT_UPI` and `VITE_TURNSTILE_SITE_KEY`. The CI deploy uses the database id that is committed in `apps/studio/wrangler.toml`. The scheduler Worker is deployed by hand (`pnpm run mailer:deploy`).

After changing code or the lockfile, run `pnpm install` before `pnpm test` and `cf:deploy`.

### Checking the live site

After a deploy, a quick manual check of the main flows:

1. Publish a page and check that the help pop-up appears.
2. Open the page in a private window and check the "Made with MadeForYou" block.
3. Report it, giving an email as the contact.
4. In `#/admin`, take it down with a reason, and check the reporter's and the owner's emails.
5. Restore it, and check that the owner can publish it again without reloading.

## Running the site

- **Review page**: `#/admin`, with your `ADMIN_TOKEN`. Open a reported page, dismiss the report, take the page down (its owner cannot publish it again) or restore it. It also shows how many people, pages and photos there are and how full the database is. The same numbers come from `GET /api/admin/usage` with the header `x-admin-token`.
- **Reports** arrive by email (if email is on) and wait in the review page. Each report has a reason box. What you write is emailed to the reporter and the page owner when you dismiss or take down, and is saved with the takedown as `Reported: <reason>. <your note>`.
- **Restoring** a page clears the takedown on the server and updates the page's `updated_at`. The owner's browser picks this up the next time they open My pages or the Publish screen, so a restored page can be published again without clearing anything.
- **Public templates** made by users go through you: `GET /api/admin/templates/pending`, then `POST /api/admin/templates/<id>/approve` or `reject`. A rejected template stays rejected when its owner saves it again.
- **Weekly**: take a backup (see Database).
- **Updating**: copy the new files over the project, then `pnpm install`, `pnpm test` and `pnpm run cf:deploy`.
- **Terms and Privacy** are the pages `#/terms` and `#/privacy`. The text is in `apps/studio/src/lib/legal.ts`. If you change what the app stores or which companies handle data, change the Privacy page too.

## Security

- **Login and ownership.** Every route that changes data needs a verified login and checks that the page, photo, template, message or delivery belongs to that person. Tests cover this.
- **Locks are enforced on the server.** Locked, ended, private and password pages return no content. A taken-down page serves nothing, and its photos stop too.
- **Page passwords** are stored as a keyed hash (HMAC-SHA256 with the server secret and a per-page salt), never as plain text. Guessing is limited to 8 tries per visitor per page per 10 minutes. It is not a slow hash, so people should choose long passwords.
- **Request size limits** are checked on the bytes that actually arrive and not on the `Content-Length` header: 400 KB of JSON, 1.5 MB per photo, 25 MB and 30 pages per person.
- **Uploads** are accepted only if the first bytes really are JPEG, PNG, WebP or one of the audio formats (WebM, MP4, Ogg, MP3). SVG is never accepted. Files are served with `nosniff`.
- **Abuse limits** on guest forms, reports (5 an hour per visitor, 20 a day per page), uploads, password tries, admin guesses and email.
- **Privacy.** Visitor addresses are only kept as a hash. Deleting an account removes the person's data at once, and deleted pages go after 30 days. The Privacy page says the same.
- **Headers.** `nosniff`, no framing, a strict referrer policy and a permissions policy on every page. Shared pages and invite links are `noindex`. The stop-emails page has its own strict content security policy.
- **The Content-Security-Policy is report-only** (`apps/studio/public/_headers`), so it does not block anything yet. Before enforcing it, open the sign-in popup and a page with a guest form on the live site with the browser console open, look for "Content-Security-Policy-Report-Only" messages, fix the policy for anything that should be allowed, then rename the header to `Content-Security-Policy`.
- **Dependencies.** The code that runs on the site has no known vulnerabilities in the last audit. The remaining advisories are in the test runner (`vitest` 3 and its `tinypool`), which only runs on a developer's machine. Moving to vitest 4 would need the studio tests' use of Node's built-in SQLite to be reworked.
- **Secrets** are never committed (`.env.*` and `.dev.vars` are git-ignored). If one leaks, set a new value and deploy again.

## Known limitations

- **Free plan limits.** D1 holds 500 MB in total, Brevo's free plan allows 300 emails a day (the site stops at 280), and Workers have limited CPU time per run. The review page shows how full the database is.
- **One scheduled job.** Email and clean-up depend on the scheduler Worker. If it stops, scheduled emails and reminders wait and are sent when it runs again.
- **Page passwords** use a keyed hash and not a deliberately slow one. Changing `SESSION_SECRET` breaks page passwords, invite links and unsubscribe links.
- **Clerk development mode** until you have a domain. The sign-in box shows a "Development mode" label.
- **Email from a personal address** can land in spam. A domain you own fixes most of that.
- **No account suspension.** The review page can take a page down, but there is no way to block a person, so the owner of a taken-down page could make a new one.
- **Third parties.** Fonts load from Google Fonts, and embedded YouTube, Vimeo, Spotify and OpenStreetMap items connect to those companies when they load (the Privacy page says so). Hosting the fonts myself would be faster and more private.
- **Only tested with fakes.** Clerk login, Turnstile, Brevo delivery and the scheduled job are tested with stand-ins in the test suite. They can only be fully checked on the live site, using `#/status`, `/api/mail/status`, the scheduler logs and the checklist above.
- **Openings.** Only the envelope opening is fully designed. The gift box, curtain and diary fall back to it.
- **Words on the page.** Text a person writes has no Hindi version unless they add one. The fixed interface words are in `packages/renderer/src/labels.ts`.
- **No linter or formatter** is set up.

## Troubleshooting

- **Sign-in works but saving says "please sign in".** The site shows a banner with the reason (it calls `/api/diag`). Usually `CLERK_ISSUER` or `CLERK_JWKS_URL` is from a different Clerk application than the publishable key, or a secret was set after the last deploy. Run `pnpm run cf:deploy` again. Stray spaces, newlines and trailing slashes are ignored.
- **"database_id" error when deploying.** `wrangler.toml` must hold the 36-character id of your database, not a URL. `pnpm run cf:deploy` fills it in, or run `pnpm exec wrangler d1 list` to see it.
- **Deploy stops with "would NOT be connected to the server".** Add `VITE_REMOTE=1` to `apps/studio/.env.production`.
- **Sign-in sends people to a Clerk page (`accounts.dev`).** See the Login section. The popup, the Google window and the `/sign-in` and `/sign-up` pages should all stay on your site.
- **The status page shows a red "Signing secret" line.** `SESSION_SECRET` is shorter than 24 characters. Set a long random one and deploy again (and see the warning about passwords and links above).
- **An email did not arrive.** Check spam, check `https://YOUR-SITE/api/mail/status`, look in the Brevo dashboard under Transactional, Logs. On the Share screen a failed email shows the reason.
- **Reminders and scheduled emails never go out.** The scheduler is not running or its secret is different (see the scheduler section).
- **The Support button is missing.** `VITE_SUPPORT_UPI` is empty, is not a valid UPI ID, is a phone number, or the site was not rebuilt after you set it.
- **Guests get "We could not confirm you are a person".** The Turnstile widget's hostname list does not match your address, or an ad blocker is blocking Cloudflare's script.
- **A test fails only on a slow computer.** The tests wait for results and not for a fixed time. If one still fails, run it alone (`pnpm exec vitest run test/<file>` in the package) and read the message.
- **Tests crash straight away on `node:sqlite`.** You are on Node 20 or older. Use Node 22 or newer.

## Notes for developers

- **Adding a block**: define it in `packages/schema/src/blocks.ts`, register it in `registry.ts`, add a component in `packages/renderer/src/blocks.tsx` or `more.tsx` (and its table), and add a description in `apps/studio/src/editor/blockInfo.ts`. The field tags (`personal`, `guided`, `required`, `prompt`, `placeholder`) drive guided mode, template stripping and the publish check automatically.
- **Editing rule**: never assign `block.fields` directly. Use `setField()`, which clears the placeholder flag and drops old translations of that field.
- **Store selectors** must return a stable value. Select `s.pages` and build lists with `useMemo`. A selector that makes a new array on every call re-renders forever.
- **Screens** other than the page viewer and the invite page are loaded on demand (`apps/studio/src/App.tsx`). Tests call `preloadScreens()` first so each screen shows up immediately.
- **Link previews**: `/p/<link>` is rendered by `functions/p/[slug].ts`, which fills in the WhatsApp card. Locked, private and password pages get a generic card.
- **Links** are stored only as https, http, mailto or tel. Videos are stored only as provider and id, and YouTube loads only when tapped.
- **The server has no Cloudflare imports**, so it can run and be tested against a D1-shaped SQLite. New routes go in `packages/api/src/app.ts` with a test next to the existing ones.

## Going live

See `docs/go-live.md` for the full checklist (domain, Clerk, email, Turnstile, mailer, security headers, backups, monitoring). `node scripts/preflight.mjs https://yourdomain.com` checks a deployment against it.
