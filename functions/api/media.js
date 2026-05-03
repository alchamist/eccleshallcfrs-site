export async function onRequestPost({ request, env }) {
  try {
    const { username, key } = await request.json();
    if (!await checkAuth(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);

    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/images/uploads`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'eccleshall-cfrs' }
    });

    if (res.status === 404) return json({ ok: true, files: [] });
    if (!res.ok) return json({ ok: false, error: 'GitHub error' }, 502);

    const files = await res.json();
    const images = files
      .filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f.name))
      .map(f => ({ name: f.name, url: f.download_url }))
      .reverse();

    return json({ ok: true, files: images });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

async function checkAuth(env, username, key) {
  if (!username || !key) return false;
  const stored = await env.CFR_ADMINS.get(username.toLowerCase());
  return stored === key;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
