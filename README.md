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
