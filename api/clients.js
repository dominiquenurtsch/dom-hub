// Client Database data source.
// Serves two CSVs (ABN INCOME + CLIENTS) to the frontend, which parses them.
// PROD: set ABN_INCOME_CSV_URL and CLIENTS_CSV_URL to the Google Sheets
//       "Publish to web -> CSV" links for each tab (live, ~5 min refresh).
// DEV:  falls back to the local private snapshots in /data (git-ignored).
const fs = require('fs');
const path = require('path');

// Published-to-web CSV URLs (public by the sheet owner's choice). Env vars override.
const DEFAULT_ABN_INCOME_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQJu6LdyGY6fSBoKSOqeK21iYdEqqhI94jGOV9EJzsGkWa3InboGiULPhAgC9A2psqJtfEFSsUgeAl/pub?output=csv';
const DEFAULT_CLIENTS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQJu6LdyGY6fSBoKSOqeK21iYdEqqhI94jGOV9EJzsGkWa3InboGiULPhAgC9A2psqJtfEFSsUgeAl/pub?gid=31959781&single=true&output=csv';

async function getCsv(envVar, defaultUrl, localFile) {
  const url = process.env[envVar] || defaultUrl;
  if (url) {
    const r = await fetch(url, { headers: { 'User-Agent': 'dom-hub/1.0' }, redirect: 'follow' });
    if (!r.ok) throw new Error(envVar + ' upstream ' + r.status);
    return { csv: await r.text(), live: true };
  }
  const p = path.join(__dirname, '..', 'data', localFile);
  if (fs.existsSync(p)) return { csv: fs.readFileSync(p, 'utf8'), live: false };
  return { csv: '', live: false, error: 'no source (' + envVar + ' unset, no snapshot)' };
}

module.exports = async function handler(req, res) {
  try {
    const [income, clients] = await Promise.all([
      getCsv('ABN_INCOME_CSV_URL', DEFAULT_ABN_INCOME_CSV_URL, 'abn-income.csv'),
      getCsv('CLIENTS_CSV_URL', DEFAULT_CLIENTS_CSV_URL, 'clients.csv'),
    ]);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json({
      income: income.csv, clients: clients.csv,
      live: { income: income.live, clients: clients.live },
      errors: { income: income.error || null, clients: clients.error || null },
    });
  } catch (err) {
    console.error('clients error:', err);
    return res.status(500).json({ error: err.message });
  }
};
