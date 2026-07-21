// Server-side proxy + parser for the public Substack RSS feed.
// Browsers can hit this cross-origin fine, but we proxy it anyway for
// consistency with the other feed integrations (calendar, clients) and
// so the frontend gets clean JSON instead of parsing XML itself.
const DEFAULT_FEED_URL = 'https://domoverseas.substack.com/feed';

function decodeEntities(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .trim();
}

function parseFeed(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1];
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
    if (!title || !link) continue;
    items.push({ title: decodeEntities(title), link: decodeEntities(link), pubDate: pubDate || '' });
  }
  return items;
}

module.exports = async function handler(req, res) {
  try {
    const url = process.env.SUBSTACK_FEED_URL || DEFAULT_FEED_URL;
    const r = await fetch(url, { headers: { 'User-Agent': 'dom-hub/1.0 (+substack-sync)' } });
    if (!r.ok) return res.status(502).json({ error: 'Upstream ' + r.status, posts: [] });
    const xml = await r.text();
    const posts = parseFeed(xml);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({ posts });
  } catch (err) {
    console.error('substack error:', err);
    return res.status(500).json({ error: err.message, posts: [] });
  }
};
