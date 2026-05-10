export async function onRequestPost({ request, env }) {
  try {
    const { username, key, path } = await request.json();
    if (!await getRole(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);
    if (!path || !path.startsWith('updates/')) return json({ ok: false, error: 'Invalid path' }, 400);

    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;

    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'eccleshall-cfrs' }
    });
    if (!getRes.ok) return json({ ok: false, error: 'File not found' }, 404);
    const { sha } = await getRes.json();

    const delRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'eccleshall-cfrs'
      },
      body: JSON.stringify({ message: `Delete update: ${path}`, sha })
    });

    if (!delRes.ok) {
      const err = await delRes.text();
      return json({ ok: false, error: 'GitHub error: ' + err }, 502);
    }

    return json({ ok: true });
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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
