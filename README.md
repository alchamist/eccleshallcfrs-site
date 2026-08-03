# Eccleshall CFRs Website

Source for [eccleshallcfrs.org.uk](https://www.eccleshallcfrs.org.uk), the public site for **Eccleshall Community First Responders** — a volunteer group trained by West Midlands Ambulance Service who respond to 999 calls in and around Eccleshall, Staffordshire (Registered Charity No. 1119804).

## Stack

Plain, dependency-free static site — no build step, no framework, no `package.json`.

- **Frontend:** hand-written HTML/CSS/JS at the repo root
- **Hosting:** Cloudflare Pages, deployed automatically from the `main` branch of this repo
- **Server logic:** Cloudflare Pages Functions in [functions/api/](functions/api/) (each file is one API route, e.g. `functions/api/login.js` → `/api/login`)
- **Data:**
  - News/updates are markdown files in `updates/` (created via the admin panel), read through the GitHub Contents API
  - Admin users, homepage widget toggles, and login rate-limit counters are stored in a Cloudflare KV namespace (`CFR_ADMINS`)
  - Uploaded images are stored in an R2 bucket (`MEDIA_BUCKET`), served from `media.eccleshallcfrs.org.uk`
- **Facebook Page Plugin** embedded on the homepage (Page ID `131270403575068`) behind a click-to-load consent gate, as the primary channel for day-to-day updates

## Site structure

| Path | Purpose |
|---|---|
| `index.html` | Homepage — hero, "Who We Are", optional on-duty/stats widgets, Facebook feed, latest news, donate CTA |
| `about.html` | What the scheme does, Queen's Award for Voluntary Service (2017) |
| `volunteer.html` | How to get involved, as a responder or in a supporting role |
| `donate.html` | JustGiving link, standing order bank details, Gift Aid, sponsorship tiers |
| `contact.html` | Contact form (submits to Formspree), email/Facebook links |
| `updates.html` / `update.html` | Full news list / single-article view, rendered client-side from `updates/*.md` |
| `sponsors.html` | Supporter/sponsor logos |
| `defib.html` | Public defibrillator (AED) location links |
| `404.html` | Custom not-found page |
| `admin/index.html` | Self-hosted admin panel (see below) |

Shared styling lives in `css/style.css`; shared update-rendering logic lives in `js/updates.js`, which reads from the public `/api/public-updates` endpoint (not GitHub directly — see below).

## Admin panel

`admin/index.html` is a bespoke single-page editor (not Decap CMS) backed by the Pages Functions in `functions/api/`:

- `login.js` — username + access-key auth against the `CFR_ADMINS` KV namespace (values are `{ key, role }`, role is `admin` or `editor`); rate-limited per IP (8 failed attempts per 15 minutes) and uses a constant-time key comparison
- `publish.js` / `delete.js` — write/delete markdown files in `updates/` via the GitHub Contents API
- `updates.js` — lists all updates (any status) for the admin dashboard
- `upload.js` / `media.js` — upload images to R2 and browse the media library
- `config.js` — admin-only toggles for the homepage "On Duty" badge and hours/incidents stats strip
- `users.js` — admin-only user management (create/list/delete editor & admin accounts)
- `public-updates.js` — public, unauthenticated, edge-cached (60s) list of published/non-expired updates, fetched from GitHub with the server's token; this is what the public pages read instead of calling GitHub's (rate-limited) API from every visitor's browser

Publishing writes a markdown file with YAML-ish frontmatter (`title`, `date`, `summary`, `image`, `status`, `end_date`) straight to the `updates/` folder on `main`. Every other admin endpoint that checks a login authenticates with the same constant-time comparison as `login.js`.

The single-update view (`update.html`) renders update bodies with `marked` and sanitizes the output with `DOMPurify` before inserting it into the page, since update content is authored by editor accounts and shouldn't be trusted as safe HTML outright.

### Required environment (Cloudflare Pages project settings)

| Binding | Type | Used for |
|---|---|---|
| `CFR_ADMINS` | KV namespace | admin/editor accounts, widget config |
| `MEDIA_BUCKET` | R2 bucket | uploaded images |
| `GITHUB_REPO` | env var | e.g. `alchamist/eccleshallcfrs-site` |
| `GITHUB_TOKEN` | secret | GitHub PAT with contents read/write on this repo |

## Local development

There's no build step — open the HTML files directly, or serve the folder with any static file server. The `/api/*` routes only work when deployed to Cloudflare Pages (or run via `wrangler pages dev`), since they depend on the KV/R2 bindings and secrets above.

## Deployment

Push to `main` — Cloudflare Pages builds and deploys automatically. There is no CI/test step; changes go live as soon as they're pushed.
