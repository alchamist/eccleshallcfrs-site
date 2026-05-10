export async function onRequestPost({ request, env }) {
  try {
    const { username, key } = await request.json();
    if (!username || !key) return json({ ok: false, error: 'Missing credentials' }, 400);

    const role = await getRole(env, username, key);
    if (!role) return json({ ok: false }, 401);

    return json({ ok: true, role });
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
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
