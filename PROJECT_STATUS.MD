# Employee Review App — Master Project Status

## What This App Is
A company-wide web app for The Scheiderich Agency. Managers generate 
AI-written employee performance reviews from raw notes, log employee 
incidents, and store formatted review documents in a shared Google 
Drive. Employees log into a separate portal to view ONLY their own 
reviews. Works on any device for any logged-in user.

## Live URL
https://app.thescheiderichagency.com
(Custom domain via Cloudflare DNS, grey-cloud / DNS-only CNAME)
Backup Vercel URL: employee-review-git-main-mike-2004s-projects.vercel.app

## Who Uses It
- Admins/Reviewers: sign in with Google (Mike = admin, Crissy = reviewer)
- Employees: sign in with username/password, see only their own reviews

## Tech Stack
- Hosting: Vercel (auto-deploys from GitHub main branch, ~60 sec)
- Domain: app.thescheiderichagency.com via Cloudflare (DNS only)
- AI: Anthropic API, model set by CLAUDE_MODEL env var (claude-sonnet-4-6)
- Storage:
  - Google Drive — formatted review Google Docs, in a SHARED DRIVE,
    organized into per-employee subfolders
  - Google Sheets — review records (read via public gviz endpoint)
  - Vercel KV — incidents, employee list, users, settings (all cloud)
- Auth: Google OAuth (managers); username/password in Vercel KV (employees)
- Frontend: Vanilla JS (app.js), index.html, employee.html

## Repo Location
C:\Users\msche\Documents\GitHub\Employee-Review
Workflow: edit in Claude Code → commit + Sync in VS Code → Vercel auto-deploys

## Key Files
- app.js — main frontend controller
- index.html — manager-facing review app
- employee.html — employee portal (own reviews only, no incident access)
- api/generate-review.js — calls Anthropic API (model from CLAUDE_MODEL env var)
- api/save-review.js — SERVER-SIDE review save: creates Doc in Shared Drive,
  per-employee subfolder, appends Sheets row, applies formatting. Uses
  Google refresh-token flow so it works for ANY user, not just the owner.
- api/reviews.js — reads review records from Google Sheets
- api/save-incident.js / api/get-incidents.js — incidents in Vercel KV
- api/save-settings.js / api/get-settings.js — employee list + settings in KV
- api/users.js — user + employee-account management (uses @vercel/kv with
  an asArray() normalizer that tolerates legacy data shapes)
- package.json — declares @vercel/kv. CommonJS (no "type":"module").
  ALL api files use require / module.exports.

## Vercel Environment Variables (reference)
- ANTHROPIC_API_KEY (secret)
- CLAUDE_MODEL = claude-sonnet-4-6
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET (secret)
- GOOGLE_REFRESH_TOKEN (secret — minted from Mike's account via OAuth Playground)
- GOOGLE_SHARED_DRIVE_ID = 0AG9CsfO4D8LuUk9PVA
- KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN, KV_URL, REDIS_URL
NOTE: env-var changes require a manual Redeploy in Vercel to take effect.

## Google Resources
- Shared Drive "Employee Reviews", ID: 0AG9CsfO4D8LuUk9PVA (Mike = manager,
  Crissy = member). This is where all new reviews are saved.
- Admin "Destination Folder ID" setting (in KV) = 0AG9CsfO4D8LuUk9PVA
- Sheet ID: 1M8LvVrgPCarObzGSWeicjpQSh43FvfSDm79wk1efOW4
  Reviews tab headers (row 1): Timestamp | Employee | Review Type |
  Review Date | Reviewer | Review Text | Doc URL
  Incidents tab: HISTORICAL only — new incidents save to Vercel KV
- Google Cloud OAuth client: "Vercel Employee Review" (Web application).
  Authorized origins include app.thescheiderichagency.com.
  Authorized redirect URIs include developers.google.com/oauthplayground.

## AI Model — IMPORTANT
- Model set by Vercel env var CLAUDE_MODEL (fallback in code: claude-sonnet-4-6)
- Anthropic retires old models periodically; retired models return 404
- If review GENERATION suddenly fails with 404: model was retired. Check
  https://docs.claude.com for current model, update CLAUDE_MODEL in Vercel,
  redeploy. No code edit needed.
- History: claude-sonnet-4-20250514 retired June 15 2026 → claude-sonnet-4-6

## Completed Features
- AI review generation
- Server-side review save (Doc + Shared Drive subfolder + Sheets row + format)
  — works for ALL users (Mike, Crissy, anyone added)
- Word doc local download
- Employee portal with "View Review" links; incidents fully hidden
- Individual logins (managers via Google, employees via password)
- Admin panel: user management, employee accounts, Drive folder setting
- Incident log via Vercel KV
- All storage cloud-based (migrated off localStorage)
- Custom domain live via Cloudflare
- Model name, Google creds, and Shared Drive ID all in env vars
- users.js standardized on @vercel/kv (fixed 500 errors)

## KNOWN SECURITY GAPS — fix in next phase (deliberate rebuild)
1. Employee portal passwords stored as PLAINTEXT in Vercel KV. Must be hashed.
2. No admin-permission gate on /api/users — anyone who reaches the endpoint
   can add/remove users or reset passwords. Add a caller-role check.
These are the "structure users properly" phase. Do them carefully as a
designed rebuild, NOT a quick patch.

## Minor Cleanup (low priority)
- app.js still contains the now-unused client-side getOrCreateFolder()
  function and the OLD Shared Drive ID 0ALICr0fW_IE7Uk9PVA (dead code,
  harmless). Remove when convenient.
- Vercel was upgraded to Pro during setup but likely not needed; downgrade
  to Hobby (free) via Settings > Billing unless growth is planned.

## Workflow
Plan in Claude chat → paste into Claude Code → review summary BEFORE applying
→ commit + Sync in VS Code → Vercel auto-deploys (~60s). Env-var changes
need a manual Redeploy. Never edit files directly on Vercel.

## Future Ideas (not started)
- Proper user/auth rebuild (hash passwords, permission gates) — NEXT PHASE
- Multi-tenancy / SaaS for other agencies (scoped ~10-15 weeks; validate
  demand first)
- Additional apps under the domain (portal., tracker., clients. subdomains)