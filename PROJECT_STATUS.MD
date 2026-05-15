# Employee Review App — Project Status

## Live URL
https://app.thescheiderichagency.com

## Tech Stack
- Hosting: Vercel (auto-deploys from GitHub main branch)
- AI: Anthropic API (claude-sonnet-4-20250514) via /api/generate-review.js
- Storage: Google Sheets (review records) + Google Drive (formatted Google Docs)
- Frontend: Vanilla JS (app.js ~1,272 lines) + index.html + employee.html

## Repo Location
C:\Users\msche\Documents\GitHub\Employee-Review

## Key Files
- app.js — main frontend controller
- index.html — manager-facing review app
- employee.html — employee portal (view own reviews)
- api/generate-review.js — Vercel serverless function (calls Anthropic)
- api/reviews.js — Vercel serverless function (reads Google Sheets)

## Google Sheet
Sheet ID: 1M8LvVrgPCarObzGSWeicjpQSh43FvfSDm79wk1efOW4
Tab: Reviews
Headers (Row 1): Timestamp | Employee | Review Type | Review Date | Reviewer | Review Text | Doc URL

## Working Features
- AI review generation
- Save to Drive & Records (creates Google Doc + logs to Sheets)
- Per-employee subfolders in Drive auto-created
- Employee portal with "View Review" button linking to Google Doc
- Vercel auto-deploy from GitHub push
- Custom domain live: https://app.thescheiderichagency.com
- localStorage migrated to Vercel KV (employee list + Drive folder ID stored company-wide in KV)
- Incident save fixed — no longer calls Google Sheets API (was failing with 403); now posts to /api/save-incident → Vercel KV
- Employee portal incident lockout confirmed — employee.html has zero incident references

## Incident Storage Note (May 15, 2026)
All new incidents are saved to Vercel KV via /api/save-incident and /api/get-incidents.
Any rows previously written to the Google Sheets "Incidents" tab are historical records only
and are no longer read or written by the app.

## Last Known Bug (May 10, 2026) — RESOLVED May 15, 2026
Craig Diego name mismatch: corrected spelling in app.js DEFAULT_EMPLOYEES list (was "Craig Diago").
Remaining action: manually correct any existing "Craig Diago" rows in Google Sheets column B to "Craig Diego".

## Next Priority Tasks (in order)
1. FIX: Manually update "Craig Diago" → "Craig Diego" in Google Sheets Reviews tab column B
2. PENDING: Admin must paste Drive Folder ID in Admin tab → Drive Folder ID field to activate KV-backed folder storage
3. REMOVE: Old Sheets-based setup UI from Admin tab (no longer needed)
4. BUILD: Individual user logins — each employee gets their own credentials
5. BUILD: Admin panel to add/manage users and assign admin-level access
6. CLEANUP: Confirm no hardcoded driveFolderName remains — use Drive folder ID from Admin setting

## Workflow
- Make changes in VS Code using Claude Code
- Commit + Sync in VS Code Source Control
- Vercel auto-deploys within ~60 seconds
- Never edit files directly on Vercel or Bluehost