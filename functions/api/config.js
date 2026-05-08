export async function onRequestGet({ env }) {
  const showDuty  = await env.CFR_ADMINS.get('cfg:show_duty');
  const showStats = await env.CFR_ADMINS.get('cfg:show_stats');
  return json({
    showDuty:  showDuty  === 'true',
    showStats: showStats === 'true'
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { username, key, showDuty, showStats } = await request.json();
    if (!await checkAuth(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);

    if (showDuty  !== undefined) await env.CFR_ADMINS.put('cfg:show_duty',  showDuty  ? 'true' : 'false');
    if (showStats !== undefined) await env.CFR_ADMINS.put('cfg:show_stats', showStats ? 'true' : 'false');

    return json({ ok: true });
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
