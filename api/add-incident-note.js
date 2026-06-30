const { kv } = require('@vercel/kv');
const { requireAdmin } = require('../lib/require-admin');

// Append-only follow-up note for an existing incident. This route NEVER
// modifies existing fields or existing entries — it only appends a new entry.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return; // response already sent

  const { id, note } = req.body || {};
  if (!note || !String(note).trim()) {
    return res.status(400).json({ error: 'Note is required' });
  }

  const record = await kv.get(id);
  if (!record) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const entries = record.entries || [];
  entries.push({
    text: String(note).trim(),
    addedBy: adminEmail,
    addedAt: new Date().toISOString(),
  });
  record.entries = entries;

  await kv.set(id, record);

  return res.status(200).json({ success: true });
}
