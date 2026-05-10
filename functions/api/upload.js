export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const username = form.get('username');
    const key = form.get('key');
    const file = form.get('file');

    if (!await getRole(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);
    if (!file || typeof file === 'string') return json({ ok: false, error: 'No file provided' }, 400);

    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) return json({ ok: false, error: 'File type not allowed' }, 400);

    const safeName = Date.now() + '-' + file.name.replace(/[^a-z0-9._-]/gi, '_');

    await env.MEDIA_BUCKET.put(safeName, file, {
      httpMetadata: { contentType: file.type }
    });

    const url = `https://media.eccleshallcfrs.org.uk/${safeName}`;
    return json({ ok: true, url });
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
