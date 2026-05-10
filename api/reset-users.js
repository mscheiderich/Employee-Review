const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const DEFAULT_USERS = [
  { email: 'mike@gahomeinsuranceexperts.com', name: 'Michael Scheiderich', role: 'admin' },
  { email: 'crissy@gahomeinsuranceexperts.com', name: 'Crissy Shatzel', role: 'reviewer' }
];

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const res2 = await fetch(`${KV_URL}/set/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: JSON.stringify(DEFAULT_USERS) })
  });
  const data = await res2.json();
  return res.status(200).end(JSON.stringify({
    success: res2.ok,
    users: DEFAULT_USERS,
    kv_response: data
  }));
};
