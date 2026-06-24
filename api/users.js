const { kv } = require('@vercel/kv');

function asArray(raw) {
  let v = raw;
  try {
    if (typeof v === 'string') v = JSON.parse(v);
    if (v && typeof v === 'object' && 'value' in v) {
      v = typeof v.value === 'string' ? JSON.parse(v.value) : v.value;
    }
  } catch { return []; }
  return Array.isArray(v) ? v : [];
}

const DEFAULT_USERS = [
  { email: 'mike@gahomeinsuranceexperts.com', name: 'Michael Scheiderich', role: 'admin' },
  { email: 'crissy@gahomeinsuranceexperts.com', name: 'Crissy Shatzel', role: 'reviewer' }
];

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.query && req.query.type === 'employees') {
    const employees = asArray(await kv.get('employees'));
    return res.status(200).end(JSON.stringify(employees));
  }

  if (req.method === 'GET') {
    let users = asArray(await kv.get('users'));
    if (users.length === 0) {
      users = DEFAULT_USERS;
      await kv.set('users', users);
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
      const employees = asArray(await kv.get('employees'));
      if (employees.find(e => e.username === username)) {
        return res.status(400).end(JSON.stringify({ error: 'Username already exists' }));
      }
      employees.push({ username, name, password: body.password, reviewName, role: 'employee' });
      await kv.set('employees', employees);
      return res.status(200).end(JSON.stringify(employees));
    }

    if (action === 'remove-employee') {
      let employees = asArray(await kv.get('employees'));
      employees = employees.filter(e => e.username !== username);
      await kv.set('employees', employees);
      return res.status(200).end(JSON.stringify(employees));
    }

    if (action === 'reset-password') {
      let employees = asArray(await kv.get('employees'));
      const idx = employees.findIndex(e => e.username === username);
      if (idx === -1) {
        return res.status(404).end(JSON.stringify({ error: 'Employee not found' }));
      }
      employees[idx].password = body.password;
      await kv.set('employees', employees);
      return res.status(200).end(JSON.stringify(employees));
    }

    if (action === 'list-employees') {
      const employees = asArray(await kv.get('employees'));
      return res.status(200).end(JSON.stringify(employees));
    }

    let users = asArray(await kv.get('users'));
    if (users.length === 0) users = DEFAULT_USERS;

    if (action === 'add') {
      if (!email || !name || !role) {
        return res.status(400).end(JSON.stringify({ error: 'Missing fields' }));
      }
      if (users.find(u => u.email === email)) {
        return res.status(400).end(JSON.stringify({ error: 'User already exists' }));
      }
      users.push({ email, name, role });
      await kv.set('users', users);
      return res.status(200).end(JSON.stringify(users));
    }

    if (action === 'remove') {
      users = users.filter(u => u.email !== email);
      await kv.set('users', users);
      return res.status(200).end(JSON.stringify(users));
    }

    return res.status(400).end(JSON.stringify({ error: 'Invalid action' }));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end(JSON.stringify({ error: 'Method not allowed' }));
};
