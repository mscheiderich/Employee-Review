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

async function kvGetEmployees() {
  const res = await fetch(`${KV_URL}/get/employees`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const data = await res.json();
  if (!data.result) return [];
  try {
    let parsed = JSON.parse(data.result);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (parsed && parsed.value) {
      parsed = typeof parsed.value === 'string'
        ? JSON.parse(parsed.value)
        : parsed.value;
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

  if (req.method === 'GET' && req.query && req.query.type === 'employees') {
    const employees = await kvGetEmployees();
    return res.status(200).end(JSON.stringify(employees));
  }

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
    const { action, email, name, role, username, reviewName } = body;

    if (action === 'add-employee') {
      if (!username || !name || !body.password || !reviewName) {
        return res.status(400).end(JSON.stringify({ error: 'Missing fields' }));
      }
      const employees = await kvGetEmployees();
      if (employees.find(e => e.username === username)) {
        return res.status(400).end(JSON.stringify({ error: 'Username already exists' }));
      }
      employees.push({ username, name, password: body.password, reviewName, role: 'employee' });
      await kvSet('employees', employees);
      return res.status(200).end(JSON.stringify(employees));
    }

    if (action === 'remove-employee') {
      let employees = await kvGetEmployees();
      employees = employees.filter(e => e.username !== username);
      await kvSet('employees', employees);
      return res.status(200).end(JSON.stringify(employees));
    }

    if (action === 'reset-password') {
      let employees = await kvGetEmployees();
      const idx = employees.findIndex(e => e.username === username);
      if (idx === -1) {
        return res.status(404).end(JSON.stringify({ error: 'Employee not found' }));
      }
      employees[idx].password = body.password;
      await kvSet('employees', employees);
      return res.status(200).end(JSON.stringify(employees));
    }

    if (action === 'list-employees') {
      const employees = await kvGetEmployees();
      return res.status(200).end(JSON.stringify(employees));
    }

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
