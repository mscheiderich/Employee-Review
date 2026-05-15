# Employee Review App — Project Status

## Live URL
https://employee-review-pi.vercel.app

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

## Last Known Bug (May 10, 2026)
Craig Diago's employee portal showed "No reviews found."
Root cause: name mismatch between Admin employee list and Sheets column B.
Status: UNRESOLVED — verify exact spelling in Sheets column B vs employee portal login name.

## Next Priority Tasks (in order)
1. RESOLVE: Craig Diago name mismatch — confirm review shows in portal
2. REMOVE: Old Sheets-based setup UI from Admin tab (no longer needed)
3. BUILD: Individual user logins — each employee gets their own credentials
4. BUILD: Admin panel to add/manage users and assign admin-level access
5. CLEANUP: Confirm no hardcoded driveFolderName remains — use Drive folder ID from Admin setting

## Workflow
- Make changes in VS Code using Claude Code
- Commit + Sync in VS Code Source Control
- Vercel auto-deploys within ~60 seconds
- Never edit files directly on Vercel or Bluehost