export async function onRequestPost({ request, env }) {
  try {
    const { username, key } = await request.json();
    if (!username || !key) return json({ ok: false, error: 'Missing credentials' }, 400);

    const stored = await env.CFR_ADMINS.get(username.toLowerCase());
    if (!stored || stored !== key) return json({ ok: false }, 401);

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
