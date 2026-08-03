export async function onRequestPost({ request, env }) {
  try {
    const { username, key } = await request.json();
    if (!await getRole(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);

    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;

    const listRes = await fetch(`https://api.github.com/repos/${repo}/contents/updates`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'eccleshall-cfrs' }
    });
    if (!listRes.ok) return json({ ok: true, updates: [] });

    const files = await listRes.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md') && f.type === 'file');

    const updates = await Promise.all(mdFiles.map(async f => {
      const res = await fetch(f.url, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'eccleshall-cfrs' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      const { meta, content } = parseFrontmatter(text);
      return {
        path: f.path,
        sha: data.sha,
        title: meta.title || f.name,
        date: meta.date || '',
        summary: meta.summary || '',
        image: meta.image || '',
        status: meta.status || 'published',
        endDate: meta.end_date || '',
        content
      };
    }));

    const sorted = updates
      .filter(Boolean)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return json({ ok: true, updates: sorted });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
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

async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a || '')),
    crypto.subtle.digest('SHA-256', enc.encode(b || ''))
  ]);
  const va = new Uint8Array(ha), vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function getRole(env, username, key) {
  if (!username || !key) return null;
  const stored = await env.CFR_ADMINS.get(username.toLowerCase());
  if (!stored) return null;
  try {
    const data = JSON.parse(stored);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return (await timingSafeEqual(data.key, key)) ? (data.role || 'editor') : null;
    }
  } catch { /* not JSON object — fall through */ }
  return (await timingSafeEqual(stored, key)) ? 'admin' : null;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
