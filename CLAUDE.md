# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repo. See [README.md](README.md) for the user-facing project overview.

## What this is

Static site for Eccleshall Community First Responders (eccleshallcfrs.org.uk), deployed on Cloudflare Pages from this repo's `main` branch. No build step, no framework, no `package.json`. Plain HTML/CSS/JS at the repo root, plus Cloudflare Pages Functions in `functions/api/` for the admin panel and public update feed.

## Git gotcha — this repo takes live commits outside your working copy

The admin panel (`admin/index.html`) publishes and deletes updates by writing directly to `updates/*.md` on `origin/main` via the GitHub Contents API (`functions/api/publish.js`, `delete.js`) — whenever a real editor uses the live site, independent of any local clone or PR flow.

**Always `git fetch` and check `git log main..origin/main` before pushing.** If there are unexpected commits, they're almost always just `Add update: ...` / `Delete update: ...` commits touching only `updates/*.md` — safe to `git rebase origin/main` and push through. Don't assume a rejected push means a conflict with your own work.

## Code conventions

- **No shared modules between `functions/api/*.js` files.** Each function file duplicates its own `getRole`/`timingSafeEqual`/`json` helpers rather than importing from a common file. This is the established style here — match it when adding new endpoints rather than introducing a shared `_lib/` module.
- **Auth pattern:** every authenticated endpoint uses the same `getRole(env, username, key)` — looks up `env.CFR_ADMINS.get(username.toLowerCase())`, expects a JSON value shaped `{ key, role }` (falls back to treating a bare string value as a legacy admin key), and compares keys with the shared `timingSafeEqual` (SHA-256 both sides, then constant-time compare) rather than `===`. If you touch auth in one endpoint, check whether the others need the same fix — that mismatch has bitten this repo before (see memory).
- **KV key prefixes in `CFR_ADMINS`:** `cfg:` for homepage widget toggles and the supporters list (`cfg:supporters`), `ratelimit:login:<ip>` for login rate-limit counters. `functions/api/users.js`'s list/create actions must keep excluding both prefixes, or they'll show up as fake "users".
- **Public vs admin update reads:** `functions/api/public-updates.js` is the public, unauthenticated, edge-cached (60s) endpoint — it's what `js/updates.js` calls for the homepage/updates pages. `functions/api/updates.js` is the authenticated admin-only endpoint (returns all statuses, used by the admin dashboard's "Published updates" list). Don't merge these — one is cached and filtered to published/non-expired, the other isn't.
- **Supporters page is data-driven:** `sponsors.html` (the "Supporters" page — the filename predates the naming) renders its logo grid client-side via `js/supporters.js` from the public `functions/api/supporters.js` (GET public, POST admin-only add/update/remove, list stored in KV as `cfg:supporters`, logos uploaded through `/api/upload`). Until an admin first changes the list the endpoint serves the `DEFAULTS` hard-coded in that file (the original NLCF + Gentili cards) — edit the list via `/admin`, not the HTML. Cards are built with DOM APIs, not `innerHTML`.
- **Rendering update content:** `update.html` renders markdown via `marked` then sanitizes with `DOMPurify` before touching the DOM. If `marked`/`DOMPurify` fail to load, fall back to `textContent` — never render raw `marked.parse()` output unsanitized, since update bodies are editor-authored, not admin-only.
- **No Facebook Page Plugin embed.** It was tried (including a click-to-load consent gate) and removed — the embedded timeline gets stuck on an infinite spinner under ad blockers / third-party-cookie restrictions in production. The homepage just links out to the Facebook page with a plain CTA button. Don't re-add the iframe embed without discussing it first.

## Required environment (Cloudflare Pages project settings)

| Binding | Type | Used for |
|---|---|---|
| `CFR_ADMINS` | KV namespace | admin/editor accounts, widget config, login rate-limit counters |
| `MEDIA_BUCKET` | R2 bucket | uploaded images |
| `GITHUB_REPO` | env var | e.g. `alchamist/eccleshallcfrs-site` |
| `GITHUB_TOKEN` | secret | GitHub PAT with contents read/write on this repo |

These aren't in the repo (no `wrangler.toml`) — they're configured in the Cloudflare Pages dashboard.

## Testing changes

There's no test suite and no CI. `/api/*` routes only work when deployed (or via `wrangler pages dev` with the bindings above configured) — plain HTML pages can be opened directly or served statically for everything else. Verify by hand: log into `/admin`, publish/edit/delete an update, check the homepage and `updates.html` pick it up.

## Deployment

Push to `main` → Cloudflare Pages auto-deploys. No staging environment, no build/CI gate — changes go live as soon as they land on `main`.
