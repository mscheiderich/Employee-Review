const { kv } = require('@vercel/kv');

// Employee portal read path (public — no admin gate). Returns only FINAL
// reviews for the named employee, newest-first, in the legacy shape that
// employee.html already consumes: [{ type, date, text, docUrl }].
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const employeeName = req.query && req.query.name
    ? req.query.name.trim()
    : null;

  if (!employeeName) {
    return res.status(400).end(JSON.stringify({
      error: 'Missing name parameter'
    }));
  }

  try {
    const index = await kv.get('reviews:index');
    if (!index || index.length === 0) {
      return res.status(200).end(JSON.stringify([]));
    }

    const sorted = [...index].sort((a, b) => {
      const tsA = parseInt(a.split(':')[1], 10);
      const tsB = parseInt(b.split(':')[1], 10);
      return tsB - tsA;
    });

    const records = await Promise.all(sorted.map(key => kv.get(key)));

    const myReviews = records
      .filter(Boolean)
      .filter(r =>
        r.status === 'final' &&
        r.employee &&
        r.employee.toLowerCase() === employeeName.toLowerCase()
      )
      .map(r => ({
        type: r.reviewType || '',
        date: r.reviewDate || '',
        text: r.reviewText || '',
        docUrl: r.docUrl || ''
      }));

    return res.status(200).end(JSON.stringify(myReviews));
  } catch (e) {
    return res.status(500).end(JSON.stringify({
      error: 'Failed to fetch reviews',
      details: e.message
    }));
  }
};
