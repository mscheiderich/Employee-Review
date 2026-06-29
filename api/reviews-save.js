const { kv } = require('@vercel/kv');
const { requireAdmin } = require('../lib/require-admin');

// Upsert a DRAFT review record in Vercel KV. No Google Doc is touched here;
// the Doc is created/updated at finalize time.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return; // response already sent

  const { id, employee, reviewType, reviewDate, reviewer, reviewText } = req.body || {};
  if (!employee || !reviewText) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = new Date().toISOString();

  // Update an existing record (preserve id/createdBy/createdAt/status/docId/docUrl).
  if (id) {
    const record = await kv.get(id);
    if (!record) {
      return res.status(404).json({ error: 'Review not found' });
    }
    record.employee   = employee;
    record.reviewType  = reviewType;
    record.reviewDate  = reviewDate;
    record.reviewer    = reviewer;
    record.reviewText  = reviewText;
    record.updatedAt   = now;
    await kv.set(id, record);
    return res.status(200).json({ success: true, id, record });
  }

  // Create a new draft.
  const key = `review:${Date.now()}`;
  const record = {
    id: key,
    status: 'draft',
    employee,
    reviewType,
    reviewDate,
    reviewer,
    reviewText,
    docId: null,
    docUrl: null,
    createdBy: admin,
    createdAt: now,
    updatedAt: now,
  };
  await kv.set(key, record);

  const index = (await kv.get('reviews:index')) || [];
  index.push(key);
  await kv.set('reviews:index', index);

  return res.status(200).json({ success: true, id: key, record });
};
