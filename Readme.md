# Scheiderich Agency — Employee Review System

## File Structure

```
Employee-Review/          ← GitHub repo (public-facing files only)
├── index.html
├── app.js
├── styles.css
└── README.md

Web server only (never commit to GitHub):
└── proxy.php             ← Contains Anthropic API key
```

## Setup Checklist

### 1. app.js — fill in your values
Open `app.js` and update the CONFIG block at the top:
- `password` — the login password for the review system
- `googleClientId` — your OAuth 2.0 Client ID from Google Cloud Console
- `sheetId` — already set to your Google Sheet ID

### 2. proxy.php — fill in your values
- `ANTHROPIC_API_KEY` — your Anthropic API key
- `$allowed_origin` — your website domain (e.g. https://www.scheiderichagency.com)

### 3. Upload proxy.php to your web server
Upload proxy.php to the same directory as your other website files.
Do NOT commit proxy.php to GitHub.

### 4. Push index.html, app.js, styles.css to GitHub
Your site should pull from GitHub automatically via your existing Zapier/deployment setup.

### 5. Set up Google Sheet
- Open your Google Sheet (ID already in app.js)
- Create a tab named exactly: `Incidents`
- Open the review tool in your browser, open the browser console (F12), and run:
  `setupSheetHeaders()`
  This writes the column headers to row 1 automatically.

### 6. Google OAuth — one-time authorization
The first time your manager clicks "Add to Log", Google will ask her to sign in
and authorize the sheet. After that it remembers for the session.

## Deploying Updates
Any changes to index.html, app.js, or styles.css:
1. Edit the file locally
2. Git commit and push to GitHub
3. Your Zapier automation deploys it to the site

proxy.php changes go directly to the web server via FTP/file manager.

## Password
Default: SchAgency2025!
Change it in app.js CONFIG.password before deploying.
