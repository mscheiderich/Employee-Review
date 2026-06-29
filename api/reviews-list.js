const { kv } = require('@vercel/kv');
const { requireAdmin } = require('../lib/require-admin');

// Admin-only: list every review record (drafts and finals) newest-first.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const index = await kv.get('reviews:index');
  if (!index || index.length === 0) {
    return res.status(200).json({ reviews: [] });
  }

  const sorted = [...index].sort((a, b) => {
    const tsA = parseInt(a.split(':')[1], 10);
    const tsB = parseInt(b.split(':')[1], 10);
    return tsB - tsA;
  });

  const records = await Promise.all(sorted.map(key => kv.get(key)));

  return res.status(200).json({ reviews: records.filter(Boolean) });
};
