// Server-side proxy for read-only calendar feeds (iCloud + Google iCal).
// Browsers can't fetch these cross-origin, so the frontend calls this
// endpoint; we fetch each feed server-side and return them as JSON.
// All feeds are *published / secret-iCal* URLs — read-only, no OAuth.
// Any URL can be overridden in production via its env var (see `env` below).

const FEEDS = [
  {
    id: 'apple', name: 'Privat', color: '#4a4844', env: 'APPLE_CAL_URL',
    url: 'https://p130-caldav.icloud.com/published/2/ODYwMTYzMjQ0ODg2MDE2M0xMiu1uK1j2kENWgpRMKuH1o6VpDaNeRHYhnY6ffLa2',
  },
  // ── Hawker (Google) — 4 calendars, each its own colour ──
  {
    id: 'hawker_personal', name: 'Hawker | Personal', color: '#a3663d', env: 'GOOGLE_CAL_URL',
    url: 'https://calendar.google.com/calendar/ical/hawkerstudiosgc%40gmail.com/private-bc411d7fb725273b72cb869cf7698772/basic.ics',
  },
  {
    id: 'hawker_studios', name: 'Hawker Studios Bookings', color: '#4f6d8c', env: 'HAWKER_STUDIOS_CAL_URL',
    url: 'https://calendar.google.com/calendar/ical/19d06b1620c2c330d6f73bb85ddf01d21f982e26b1fad1ab42c6b6b13a81f39d%40group.calendar.google.com/private-637ff297d4675b9032288dc6d044e207/basic.ics',
  },
  {
    id: 'h27_personal', name: 'H27 | Personal', color: '#5f7a5a', env: 'H27_PERSONAL_CAL_URL',
    url: 'https://calendar.google.com/calendar/ical/084a6161cab84c3aecac8d6e8b7e5b9c1379ee19b77d24b7ebd03b27a67cb053%40group.calendar.google.com/private-f75af5162100262c41d949d0201ba1c2/basic.ics',
  },
  {
    id: 'h27_bookings', name: 'Hawker27 Bookings', color: '#8a5a7a', env: 'H27_BOOKINGS_CAL_URL',
    url: 'https://calendar.google.com/calendar/ical/b1b9f1da7253cf9ddcad33461e7c52ade5ad7c68c5e6e3100a28d72003ccfd59%40group.calendar.google.com/private-ded5d2a8ad78893d87fd10dc05169528/basic.ics',
  },
];

async function fetchFeed(feed) {
  const base = { id: feed.id, name: feed.name, color: feed.color };
  try {
    const url = (process.env[feed.env] || feed.url).replace(/^webcal:\/\//i, 'https://');
    if (!url) return { ...base, ics: '', error: 'no url' };
    const r = await fetch(url, { headers: { 'User-Agent': 'dom-hub/1.0 (+calendar-sync)' } });
    if (!r.ok) return { ...base, ics: '', error: 'Upstream ' + r.status };
    return { ...base, ics: await r.text() };
  } catch (err) {
    return { ...base, ics: '', error: err.message };
  }
}

module.exports = async function handler(req, res) {
  try {
    const feeds = await Promise.all(FEEDS.map(fetchFeed));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ feeds });
  } catch (err) {
    console.error('calendar error:', err);
    return res.status(500).json({ error: err.message });
  }
};
