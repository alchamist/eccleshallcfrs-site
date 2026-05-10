export async function onRequestPost({ request, env }) {
  try {
    const { username, key } = await request.json();
    if (!await getRole(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);

    const listed = await env.MEDIA_BUCKET.list();
    const images = listed.objects
      .filter(obj => /\.(png|jpe?g|gif|webp)$/i.test(obj.key))
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
      .map(obj => ({
        name: obj.key,
        url: `https://media.eccleshallcfrs.org.uk/${obj.key}`
      }));

    return json({ ok: true, files: images });
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
    return data.key === key ? (data.role || 'editor') : null;
  } catch {
    return stored === key ? 'admin' : null;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
