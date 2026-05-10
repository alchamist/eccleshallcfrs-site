export async function onRequestPost({ request, env }) {
  try {
    const { username, key, title, date, summary, content, editPath, status, endDate, image } = await request.json();

    if (!await getRole(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);
    if (!title || !date || !content) return json({ ok: false, error: 'title, date and content are required' }, 400);

    const slug = slugify(title) + '-' + date;
    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `date: "${date}"`,
      summary ? `summary: "${summary.replace(/"/g, '\\"')}"` : '',
      image   ? `image: "${image.replace(/"/g, '\\"')}"` : '',
      `status: "${status || 'published'}"`,
      endDate ? `end_date: "${endDate}"` : '',
      '---',
      ''
    ].filter(Boolean).join('\n');

    const markdown = frontmatter + '\n' + content;
    const encoded = btoa(unescape(encodeURIComponent(markdown)));

    const path = editPath || `updates/${slug}.md`;
    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;

    let sha;
    const check = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'eccleshall-cfrs' }
    });
    if (check.ok) {
      const existing = await check.json();
      sha = existing.sha;
    }

    const body = {
      message: editPath ? `Update: ${title}` : `Add update: ${title}`,
      content: encoded,
      ...(sha ? { sha } : {})
    };

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'eccleshall-cfrs'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ ok: false, error: 'GitHub error: ' + err }, 502);
    }

    return json({ ok: true, path });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

async function getRole(env, username, key) {
  if (!username || !key) return null;
  const stored = await env.CFR_ADMINS.get(username.toLowerCase());
  if (!stored) return null;
  try {
    const data = JSON.parse(stored);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data.key === key ? (data.role || 'editor') : null;
    }
  } catch { /* not JSON object — fall through */ }
  return stored === key ? 'admin' : null;
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
