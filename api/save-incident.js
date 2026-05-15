const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { employee, date, type, description, actionTaken, loggedBy } = req.body;
  if (!employee || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const key = `incident:${Date.now()}`;
  const incident = {
    employee,
    date: date || new Date().toISOString().split('T')[0],
    type,
    description,
    actionTaken,
    loggedBy,
  };

  await kv.set(key, incident);

  const index = (await kv.get('incident-index')) || [];
  index.push(key);
  await kv.set('incident-index', index);

  return res.status(200).json({ success: true });
}
