export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const username = form.get('username');
    const key = form.get('key');
    const file = form.get('file');

    if (!await checkAuth(env, username, key)) return json({ ok: false, error: 'Unauthorised' }, 401);
    if (!file || typeof file === 'string') return json({ ok: false, error: 'No file provided' }, 400);

    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) return json({ ok: false, error: 'File type not allowed' }, 400);

    const ext = file.name.split('.').pop().toLowerCase();
    const safeName = Date.now() + '-' + file.name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `images/uploads/${safeName}`;

    const buffer = await file.arrayBuffer();
    const encoded = arrayBufferToBase64(buffer);

    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'eccleshall-cfrs'
      },
      body: JSON.stringify({
        message: `Upload image: ${safeName}`,
        content: encoded
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ ok: false, error: 'GitHub error: ' + err }, 502);
    }

    const url = `https://raw.githubusercontent.com/${repo}/main/${path}`;
    return json({ ok: true, url });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

async function checkAuth(env, username, key) {
  if (!username || !key) return false;
  const stored = await env.CFR_ADMINS.get(username.toLowerCase());
  return stored === key;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
