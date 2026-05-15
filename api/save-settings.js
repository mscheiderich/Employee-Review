const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });

  await kv.set(key, value);
  return res.status(200).json({ success: true });
}
