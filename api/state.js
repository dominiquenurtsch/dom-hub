// Server-side persistence for the dashboard's editable data.
// Stores one JSON blob in Upstash Redis (KV) so Dom's numbers survive a
// browser-cache clear and stay in sync across her devices (phone + laptop).
// No auth by design — the URL is private and the data is non-sensitive.
//
// Env vars are injected by the Vercel↔Upstash integration (prefix "domi"):
//   domi_KV_REST_API_URL   — Upstash REST endpoint
//   domi_KV_REST_API_TOKEN — read/write token
const REST_URL = process.env.domi_KV_REST_API_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.domi_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = 'dom_hub_state';

async function redis(cmd) {
  const r = await fetch(REST_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REST_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const text = await r.text();
  if (!r.ok) throw new Error('Upstash ' + r.status + ': ' + text);
  return JSON.parse(text);
}

module.exports = async function handler(req, res) {
  if (!REST_URL || !REST_TOKEN) {
    return res.status(500).json({ error: 'KV env vars missing (domi_KV_REST_API_URL / _TOKEN)' });
  }
  try {
    if (req.method === 'GET') {
      const out = await redis(['GET', KEY]);
      const state = out && out.result ? JSON.parse(out.result) : {};
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ state });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      if (!body || typeof body !== 'object') body = {};
      const state = body.state && typeof body.state === 'object' ? body.state : {};
      await redis(['SET', KEY, JSON.stringify(state)]);
      return res.status(200).json({ ok: true, keys: Object.keys(state).length });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('state error:', err);
    return res.status(500).json({ error: err.message });
  }
};
