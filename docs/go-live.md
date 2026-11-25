# Going live

Work through this top to bottom. When you finish, run the preflight check at the bottom.

## 1. Domain

1. Buy a domain and add it to Cloudflare (Websites, Add a site).
2. In Workers & Pages, open the `madeforyou` project, then Custom domains, and add `yourdomain.com` and `www.yourdomain.com`.
3. Set `PUBLIC_URL` to `https://yourdomain.com` as a variable on the Pages project, so email links never use a one-off deploy address.

## 2. Sign-in (Clerk production)

1. In Clerk, create the production instance from your development one, and add your domain.
2. Clerk shows DNS records (a `clerk` subdomain and a few more). Add them in Cloudflare DNS with the proxy turned off (grey cloud).
3. Under Social connections, set up Google with your own Google OAuth client. The shared development one does not carry over.
4. Set these:
   - GitHub secret `VITE_CLERK_PUBLISHABLE_KEY` to the new `pk_live_` key
   - Pages secret `CLERK_ISSUER` to the production issuer shown in Clerk, for example `https://clerk.yourdomain.com`
   - GitHub variable `CLERK_FRONTEND_HOST` to `clerk.yourdomain.com`

## 3. Email

1. In Brevo, go to Senders, Domains and add your domain.
2. Add the DNS records Brevo shows (a brevo code TXT record, two DKIM records, and SPF). If you already have an SPF record, merge Brevo into it rather than adding a second one.
3. Add a DMARC record: TXT on `_dmarc` with `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`. Move to `p=quarantine` after a few weeks of clean reports.
4. Set on the Pages project:
   - `BREVO_API_KEY`
   - `MAIL_FROM` to something like `hello@yourdomain.com`
   - `REPORT_EMAIL` to a mailbox you read daily
5. Send a test delivery and a test report, and look at both in Gmail and on your phone.

## 4. Bot protection

1. In Cloudflare, open Turnstile and add a widget for your domain.
2. Set Pages secret `TURNSTILE_SECRET` and GitHub variable `VITE_TURNSTILE_SITE_KEY`.

## 5. Scheduled emails

1. `cd apps/studio && pnpm mailer:deploy`
2. `pnpm mailer:secret` and enter the same value you set as `CRON_SECRET` on the Pages project.
3. Open `/api/mail/status` and check that `reminders` is `true`.

## 6. Secrets check

- `ALLOW_DEV_AUTH` is `0`
- `SESSION_SECRET` is at least 24 random characters, and is never changed later (that breaks page passwords, invite links and unsubscribe links)
- `ADMIN_TOKEN` is long and random
- `CRON_SECRET` is long and random

## 7. Turn on the strict security policy

1. Set GitHub variable `CSP_ENFORCE` to `1` and push. The build then switches the policy from report-only to enforced and swaps in your Clerk domain.
2. Open the site in a private window and test: sign in with Google, sign in with email, publish a page, upload a photo, play a video, open a map, and send a guest reply. Watch the browser console for blocked requests.
3. If something is blocked, add that host to the matching directive in `apps/studio/public/_headers`, then redeploy.

## 8. Backups and monitoring

- Add the `BACKUP_PASSPHRASE` GitHub secret, then run the Database backup workflow once from the Actions tab and confirm it produces a file.
- Add the GitHub variable `SITE_URL` (for example `https://yourdomain.com`). The Uptime check workflow then pings the site every 15 minutes, and GitHub emails you when it fails.
- Run `pnpm audit --prod` and read the result before launch.

## 9. Preflight

```
node scripts/preflight.mjs https://yourdomain.com
```

Fix every FAIL line. Then test on a real Android phone and an iPhone, including the in-app browsers in WhatsApp and Instagram, which is where most page links will be opened.
