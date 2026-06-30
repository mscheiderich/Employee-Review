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
  - Vercel KV — reviews (source of truth), incidents, employee list,
    users, settings (all cloud)
  - Google Sheets — RETIRED from the review pipeline (no longer read or
    written). Historical rows remain in the sheet but are unused.
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
- Reviews are KV-backed records: keys `review:{timestamp}` + a `reviews:index`
  array of keys. Each record has a `status` field: 'draft' or 'final'. KV is
  the SOURCE OF TRUTH for reviews. Record fields use reviewType/reviewDate
  (NOT type/date) consistently across save, finalize, list, and portal read.
- api/reviews-save.js — DRAFT upsert in KV (creates or updates a record).
  Admin-gated.
- api/reviews-finalize.js — finalize a review: creates the Google Doc on the
  FIRST finalize; on re-finalize it updates the SAME Doc in place (clears the
  body, re-applies formatting) so the employee-facing link never changes.
  Sets status='final', docId, docUrl. Admin-gated. Uses Google refresh-token
  flow so it works for ANY admin. (Supersedes save-review.js.)
- api/reviews-list.js — admin review history; returns all records (drafts +
  finals) newest-first. Admin-gated.
- lib/require-admin.js — verifies the caller's Google Bearer token against
  https://www.googleapis.com/oauth2/v3/userinfo and checks the email against
  the ADMIN_EMAILS env var. Sends 401 (bad/missing token) or 403 (not an
  admin) and returns null; otherwise returns the admin email.
- api/reviews.js — employee portal read: returns FINALIZED records from KV
  for ?name= (case-insensitive). Reads KV, NOT Google Sheets gviz.
- api/save-review.js — DEAD CODE. Superseded by reviews-finalize.js (it still
  writes a Sheets row + uses the old flow). Flagged for removal in a future
  cleanup; left in place for now.
- Incidents are an APPEND-ONLY log in Vercel KV. Keys `incident:{timestamp}`
  + an `incident-index` array. Each record carries a stable `id` (= its key)
  and `createdAt`. The original entry (employee/date/type/description/
  actionTaken) is IMMUTABLE once created; follow-ups are appended to an
  `entries[]` array, each `{ text, addedBy, addedAt }` with addedBy/loggedBy
  server-stamped from the verified admin email. NO edit or delete path by
  design (HR chain-of-custody requirement).
- api/save-incident.js / api/get-incidents.js — create + list incidents.
  Now ADMIN-GATED via lib/require-admin.js (previously open).
- api/add-incident-note.js — append-only follow-up note (POST). Admin-gated.
  Never modifies existing fields or existing entries.
- api/save-settings.js / api/get-settings.js — employee list + settings in KV
- api/users.js — user + employee-account management (uses @vercel/kv with
  an asArray() normalizer that tolerates legacy data shapes)
- package.json — declares @vercel/kv. CommonJS (no "type":"module").
  ALL api files use require / module.exports.

## Vercel Environment Variables (reference)
- ANTHROPIC_API_KEY (secret)
- CLAUDE_MODEL = claude-sonnet-4-6
- ADMIN_EMAILS (REQUIRED, NEW) = comma-separated admin Google emails (e.g.
  mike@…,crissy@…). The review save/finalize/list routes are admin-gated and
  return 403 for everyone until this is set. Env-var change → manual Redeploy.
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
  RETIRED from the review pipeline — no longer read or written. Reviews now
  live in Vercel KV. Reviews tab (Timestamp | Employee | Review Type | Review
  Date | Reviewer | Review Text | Doc URL) and Incidents tab are HISTORICAL
  only; nothing new is written to either.
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
- KV-backed reviews (SOURCE OF TRUTH): records keyed `review:{timestamp}`
  with a `reviews:index` array; each record's `status` is 'draft' or 'final'.
  Fields use reviewType/reviewDate (NOT type/date) consistently across save,
  finalize, list, and the portal read. Lifecycle: Save Draft (KV only, no
  Google Doc, invisible to employees) → Finalize (creates the Google Doc) →
  Edit a finalized review (updates the SAME Doc in place so the employee link
  never changes). Drafts are shared among admins — either admin can pick up
  and finish the other's draft. Routes (all admin-gated): reviews-save.js
  (draft upsert), reviews-finalize.js (create-or-update-Doc-in-place + flip
  to final), reviews-list.js (admin history); reviews.js (employee portal
  read) reads FINALIZED records from KV, not Google Sheets gviz. Google
  Sheets fully retired from the review pipeline; save-review.js is dead code.
- Word doc local download
- Employee portal with "View Review" links; incidents fully hidden
- Individual logins (managers via Google, employees via password)
- Admin panel: user management, employee accounts, Drive folder setting
- Append-only incident log in Vercel KV: immutable original entry + appended
  `entries[]` follow-ups, addedBy server-stamped from the verified admin
  email, no edit/delete path by design (HR chain-of-custody). All incident
  endpoints admin-gated. Per-incident PDF export via downloadIncidentPdf — a
  frontend-only print view → browser "Save as PDF" (no backend, no Drive
  write); PDF chosen over Word deliberately so exported HR records aren't
  trivially editable.
- All storage cloud-based (migrated off localStorage)
- Custom domain live via Cloudflare
- Model name, Google creds, and Shared Drive ID all in env vars
- users.js standardized on @vercel/kv (fixed 500 errors)

## KNOWN SECURITY GAPS — fix in next phase (deliberate rebuild)
RESOLVED: incident endpoints (save-incident / get-incidents / add-incident-
note) are no longer open — all admin-gated via lib/require-admin.js.

STILL OPEN (defer to the auth phase):
1. Employee portal passwords stored as PLAINTEXT in Vercel KV. Must be hashed.
2. No admin-permission gate on /api/users — anyone who reaches the endpoint
   can add/remove users or reset passwords. Add a caller-role check.
3. api/reviews.js (employee portal read) has NO employee auth — anyone who
   passes ?name=<employee> gets that employee's finalized reviews. The portal
   relies on session state only; the endpoint itself is open. Needs a per-
   employee identity / token check.
These are the "structure users properly" phase. Do them carefully as a
designed rebuild, NOT a quick patch.

## Minor Cleanup (low priority)
- api/save-review.js is dead code (superseded by reviews-finalize.js). Remove
  in a future cleanup once the new flow is confirmed stable in production.
- @vercel/kv is deprecated; migrate to @upstash/redis (one-line client swap
  reusing existing KV_REST_API_URL / KV_REST_API_TOKEN). Deferred — not
  urgent; do as its own isolated change.
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