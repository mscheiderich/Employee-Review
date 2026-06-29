// Admin authorization gate for review API routes.
// Verifies the caller's Google OAuth Bearer token and checks the email
// against the ADMIN_EMAILS allowlist. On any failure it sends the HTTP
// response itself and returns null, so callers just do:
//   const admin = await requireAdmin(req, res);
//   if (!admin) return;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization token.' });
    return null;
  }

  let email = null;
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!infoRes.ok) {
      res.status(401).json({ error: 'Invalid authorization token.' });
      return null;
    }
    const info = await infoRes.json().catch(() => null);
    email = info && info.email ? String(info.email).trim().toLowerCase() : null;
  } catch {
    res.status(401).json({ error: 'Could not verify authorization token.' });
    return null;
  }

  if (!email) {
    res.status(401).json({ error: 'Invalid authorization token.' });
    return null;
  }

  if (!ADMIN_EMAILS.includes(email)) {
    res.status(403).json({ error: 'You are not authorized to perform this action.' });
    return null;
  }

  return email;
}

module.exports = { requireAdmin };
