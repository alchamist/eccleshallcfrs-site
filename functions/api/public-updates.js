// Public, unauthenticated endpoint used by the site's own pages (via js/updates.js)
// to render the news list without every visitor hitting GitHub's API directly —
// that path is rate-limited per source IP and shared across everyone behind the
// same address. Reads happen here with the server's GitHub token instead, and the
// edge caches the result briefly so a burst of visitors costs one GitHub fetch.
const CACHE_SECONDS = 60;

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), request);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_TOKEN;

  let updates = [];
  const listRes = await fetch(`https://api.github.com/repos/${repo}/contents/updates`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'eccleshall-cfrs' }
  });

  if (listRes.ok) {
    const files = await listRes.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md') && f.type === 'file');

    const all = await Promise.all(mdFiles.map(async f => {
      const res = await fetch(f.url, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'eccleshall-cfrs' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      const { meta, content } = parseFrontmatter(text);
      return {
        filename: f.name,
        title: meta.title || f.name,
        date: meta.date || '',
        summary: meta.summary || '',
        image: meta.image || '',
        status: meta.status || 'published',
        endDate: meta.end_date || '',
        body: content
      };
    }));

    const today = new Date().toISOString().slice(0, 10);
    updates = all
      .filter(Boolean)
      .filter(u => u.status === 'published')
      .filter(u => !u.endDate || today < u.endDate)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  const response = json({ ok: true, updates });
  response.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, content: text.trim() };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, content: match[2].trim() };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
