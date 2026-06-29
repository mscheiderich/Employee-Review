const { kv } = require('@vercel/kv');
const { requireAdmin } = require('../lib/require-admin');

const DRIVE_ID = process.env.GOOGLE_SHARED_DRIVE_ID || '0AG9CsfO4D8LuUk9PVA';

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.access_token) {
    throw new Error((data && data.error_description) || 'Could not obtain Google access token.');
  }
  return data.access_token;
}

async function getOrCreateFolder(name, parentId, token) {
  const query = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${DRIVE_ID}`,
    { headers: { 'Authorization': 'Bearer ' + token } }
  );
  const searchData = await searchRes.json().catch(() => null);
  if (searchData && searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
        driveId: DRIVE_ID,
      }),
    }
  );
  const createData = await createRes.json().catch(() => null);
  if (!createRes.ok || !createData || !createData.id) {
    throw new Error((createData && createData.error && createData.error.message) || 'Could not create Drive folder.');
  }
  return createData.id;
}

// Wipe the existing body of a Doc so the new formatting requests can be
// applied to the SAME Doc (preserving the employee-facing link/URL).
async function clearDocBody(docId, token) {
  const getRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  const doc = await getRes.json().catch(() => null);
  if (!getRes.ok || !doc || !doc.body || !Array.isArray(doc.body.content)) {
    throw new Error((doc && doc.error && doc.error.message) || 'Could not read existing Doc.');
  }
  const content = doc.body.content;
  const last = content[content.length - 1];
  const endIndex = last && last.endIndex ? last.endIndex : 1;
  // A Doc always keeps a trailing newline at endIndex-1 that cannot be
  // deleted; if the body is otherwise empty there is nothing to clear.
  if (endIndex <= 2) return;
  const delRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } }] }),
  });
  if (!delRes.ok) {
    const d = await delRes.json().catch(() => null);
    throw new Error((d && d.error && d.error.message) || 'Could not clear existing Doc.');
  }
}

async function applyRequests(docId, requests, token) {
  const docsRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!docsRes.ok) {
    const docsData = await docsRes.json().catch(() => null);
    throw new Error((docsData && docsData.error && docsData.error.message) || 'Could not format Google Doc.');
  }
}

// Finalize a review: write the Google Doc (creating it the first time,
// updating the same Doc in place thereafter) and mark the KV record final.
// NOTE: deliberately does NOT append to Google Sheets — Sheets is retired
// from the review pipeline.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return res.status(500).json({ success: false, error: 'Server is missing Google credentials.' });
  }

  const { id, employee, reviewType, reviewDate, reviewer, reviewText, requests } = req.body || {};
  if (!employee || !reviewText || !Array.isArray(requests)) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }

  try {
    const token = await getAccessToken();
    const now = new Date().toISOString();

    // Load existing record if updating.
    let record = null;
    if (id) {
      record = await kv.get(id);
      if (!record) {
        return res.status(404).json({ success: false, error: 'Review not found' });
      }
    }

    let docId = record && record.docId ? record.docId : null;
    let docUrl = record && record.docUrl ? record.docUrl : null;

    if (docId) {
      // Update the SAME Doc in place so the employee link never changes.
      await clearDocBody(docId, token);
      await applyRequests(docId, requests, token);
    } else {
      // Create a fresh Doc in the employee's subfolder.
      const configuredRoot = await kv.get('drive-folder-id');
      const rootFolderId = configuredRoot || await getOrCreateFolder('Employee Reviews', 'root', token);
      const empFolderId = await getOrCreateFolder(employee, rootFolderId, token);
      const fileName = `${reviewType || 'Review'} - ${reviewDate || new Date().toISOString().split('T')[0]}`;
      const createRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: fileName,
            mimeType: 'application/vnd.google-apps.document',
            parents: [empFolderId],
            driveId: DRIVE_ID,
          }),
        }
      );
      const createdDoc = await createRes.json().catch(() => null);
      if (!createRes.ok || !createdDoc || !createdDoc.id) {
        throw new Error((createdDoc && createdDoc.error && createdDoc.error.message) || 'Could not create Google Doc.');
      }
      docId = createdDoc.id;
      docUrl = createdDoc.webViewLink || `https://docs.google.com/document/d/${createdDoc.id}/edit`;
      await applyRequests(docId, requests, token);
    }

    // Persist the finalized record.
    if (record) {
      record.employee   = employee;
      record.reviewType  = reviewType;
      record.reviewDate  = reviewDate;
      record.reviewer    = reviewer;
      record.reviewText  = reviewText;
      record.status      = 'final';
      record.docId       = docId;
      record.docUrl      = docUrl;
      record.finalizedAt = now;
      record.updatedAt   = now;
      await kv.set(record.id, record);
      return res.status(200).json({ success: true, id: record.id, docUrl });
    }

    const key = `review:${Date.now()}`;
    record = {
      id: key,
      status: 'final',
      employee,
      reviewType,
      reviewDate,
      reviewer,
      reviewText,
      docId,
      docUrl,
      createdBy: admin,
      createdAt: now,
      updatedAt: now,
      finalizedAt: now,
    };
    await kv.set(key, record);

    const index = (await kv.get('reviews:index')) || [];
    index.push(key);
    await kv.set('reviews:index', index);

    return res.status(200).json({ success: true, id: key, docUrl });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message || 'Failed to finalize review.' });
  }
};
