const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const data = await res.json();
  if (!data.result) return null;
  try {
    const parsed = JSON.parse(data.result);
    if (typeof parsed === 'string') return JSON.parse(parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
  return res.ok;
}

const DEFAULT_USERS = [
  { email: 'mike@gahomeinsuranceexperts.com', name: 'Michael Scheiderich', role: 'admin' },
  { email: 'crissy@gahomeinsuranceexperts.com', name: 'Crissy Shatzel', role: 'reviewer' }
];

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    let users = await kvGet('users');
    if (!users) {
      users = DEFAULT_USERS;
      await kvSet('users', users);
    }
    return res.status(200).end(JSON.stringify(users));
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    const { action, email, name, role } = body;
    let users = await kvGet('users') || DEFAULT_USERS;

    if (action === 'add') {
      if (!email || !name || !role) {
        return res.status(400).end(JSON.stringify({ error: 'Missing fields' }));
      }
      if (users.find(u => u.email === email)) {
        return res.status(400).end(JSON.stringify({ error: 'User already exists' }));
      }
      users.push({ email, name, role });
      await kvSet('users', users);
      return res.status(200).end(JSON.stringify(users));
    }

    if (action === 'remove') {
      users = users.filter(u => u.email !== email);
      await kvSet('users', users);
      return res.status(200).end(JSON.stringify(users));
    }

    return res.status(400).end(JSON.stringify({ error: 'Invalid action' }));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end(JSON.stringify({ error: 'Method not allowed' }));
};
