const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Missing key' });

  const result = await kv.get(key);
  return res.status(200).json({ value: result ?? null });
}
