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

async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a || '')),
    crypto.subtle.digest('SHA-256', enc.encode(b || ''))
  ]);
  const va = new Uint8Array(ha), vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function getRole(env, username, key) {
  if (!username || !key) return null;
  const stored = await env.CFR_ADMINS.get(username.toLowerCase());
  if (!stored) return null;
  try {
    const data = JSON.parse(stored);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return (await timingSafeEqual(data.key, key)) ? (data.role || 'editor') : null;
    }
  } catch { /* not JSON object — fall through */ }
  return (await timingSafeEqual(stored, key)) ? 'admin' : null;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
