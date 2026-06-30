const { kv } = require('@vercel/kv');
const { requireAdmin } = require('../lib/require-admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return; // response already sent

  const { employee, date, type, description, actionTaken } = req.body || {};
  if (!employee || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const key = `incident:${Date.now()}`;
  const incident = {
    id: key,
    createdAt: new Date().toISOString(),
    employee,
    date: date || new Date().toISOString().split('T')[0],
    type,
    description,
    actionTaken,
    loggedBy: adminEmail,
    entries: [],
  };

  await kv.set(key, incident);

  const index = (await kv.get('incident-index')) || [];
  index.push(key);
  await kv.set('incident-index', index);

  return res.status(200).json({ success: true });
}
