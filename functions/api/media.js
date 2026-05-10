export async function onRequestPost({ request, env }) {
  try {
    const { username, key } = await request.json();
    if (!await checkAuth(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);

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
