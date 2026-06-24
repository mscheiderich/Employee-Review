const { kv } = require('@vercel/kv');

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return res.status(500).json({ success: false, error: 'Server is missing Google credentials.' });
  }

  const { employee, type, date, reviewer, reviewText, sheetId, sheetTab, requests } = req.body || {};
  if (!employee || !reviewText || !sheetId || !sheetTab || !Array.isArray(requests)) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }

  try {
    // a) Fresh Google access token from the refresh token.
    const token = await getAccessToken();

    // b) Root folder: prefer the configured ID in KV, else find/create 'Employee Reviews'.
    const configuredRoot = await kv.get('drive-folder-id');
    const rootFolderId = configuredRoot || await getOrCreateFolder('Employee Reviews', 'root', token);

    // c) Employee subfolder inside the root.
    const empFolderId = await getOrCreateFolder(employee, rootFolderId, token);

    // d) Create a blank Google Doc in the employee subfolder.
    const fileName = `${type} - ${date || new Date().toISOString().split('T')[0]}`;
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
    const docUrl = createdDoc.webViewLink ||
      `https://docs.google.com/document/d/${createdDoc.id}/edit`;

    // e) Append a row to the Records sheet (columns A-G).
    const row = [new Date().toISOString(), employee, type, date, reviewer, String(reviewText).substring(0, 5000), docUrl];
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetTab}!A:G:append?valueInputOption=USER_ENTERED`;
    const sheetsRes = await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    });
    if (!sheetsRes.ok) {
      const sheetsData = await sheetsRes.json().catch(() => null);
      throw new Error((sheetsData && sheetsData.error && sheetsData.error.message) || 'Could not append to the Records sheet.');
    }

    // f) Apply the formatting requests to the new Doc.
    const docsRes = await fetch(`https://docs.googleapis.com/v1/documents/${createdDoc.id}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
    if (!docsRes.ok) {
      const docsData = await docsRes.json().catch(() => null);
      throw new Error((docsData && docsData.error && docsData.error.message) || 'Could not format Google Doc.');
    }

    return res.status(200).json({ success: true, docUrl });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message || 'Failed to save review.' });
  }
};
