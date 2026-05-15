const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const index = await kv.get('incident-index');
  if (!index || index.length === 0) {
    return res.status(200).json({ incidents: [] });
  }

  const sorted = [...index].sort((a, b) => {
    const tsA = parseInt(a.split(':')[1], 10);
    const tsB = parseInt(b.split(':')[1], 10);
    return tsB - tsA;
  });

  const incidents = await Promise.all(sorted.map(key => kv.get(key)));

  return res.status(200).json({ incidents: incidents.filter(Boolean) });
}
