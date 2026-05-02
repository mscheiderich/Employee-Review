const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = '2023-06-01';

function sendJson(res, statusCode, body) {
  res.status(statusCode).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Invalid JSON request body');
    }
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON request body');
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, {
      error: 'Method not allowed. Use POST.',
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, {
      error: 'Server is missing ANTHROPIC_API_KEY.',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJson(res, 400, {
      error: err.message || 'Invalid request body.',
    });
  }

  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return sendJson(res, 400, {
      error: 'Missing or invalid prompt.',
    });
  }

  const payload = {
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: body.prompt,
      },
    ],
  };

  try {
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    });

    const data = await anthropicRes.json().catch(() => null);

    if (!anthropicRes.ok) {
      return sendJson(res, anthropicRes.status, {
        error: 'Anthropic API request failed.',
        details: data || null,
      });
    }

    return sendJson(res, 200, data);
  } catch (err) {
    return sendJson(res, 502, {
      error: 'Failed to reach Anthropic API.',
      details: err.message || 'Unknown error',
    });
  }
};
