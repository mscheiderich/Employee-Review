const SHEET_ID = '1M8LvVrgPCarObzGSWeicjpQSh43FvfSDm79wk1efOW4';
const REVIEW_SHEET = 'Reviews';

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
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(REVIEW_SHEET)}`;
    const response = await fetch(url);
    const text = await response.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;
    const cols = json.table.cols.map(c => c.label);

    const empIdx = cols.indexOf('Employee');
    const typeIdx = cols.indexOf('Review Type');
    const dateIdx = cols.indexOf('Review Date');
    const textIdx = cols.indexOf('Review Text');

    const myReviews = rows
      .filter(row => {
        const val = row.c[empIdx] && row.c[empIdx].v;
        return val &&
          val.toLowerCase() === employeeName.toLowerCase();
      })
      .map(row => ({
        type: row.c[typeIdx] ? row.c[typeIdx].v : '',
        date: row.c[dateIdx] ? row.c[dateIdx].v : '',
        text: row.c[textIdx] ? row.c[textIdx].v : ''
      }))
      .reverse();

    return res.status(200).end(JSON.stringify(myReviews));
  } catch(e) {
    return res.status(500).end(JSON.stringify({
      error: 'Failed to fetch reviews',
      details: e.message
    }));
  }
};
