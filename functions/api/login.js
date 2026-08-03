const MAX_ATTEMPTS = 8;
const WINDOW_SECONDS = 900; // 15 minutes

export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey = `ratelimit:login:${ip}`;

    const attempts = parseInt(await env.CFR_ADMINS.get(rlKey), 10) || 0;
    if (attempts >= MAX_ATTEMPTS) {
      return json({ ok: false, error: 'Too many attempts — please try again later.' }, 429);
    }

    const { username, key } = await request.json();
    if (!username || !key) return json({ ok: false, error: 'Missing credentials' }, 400);

    const role = await getRole(env, username, key);
    if (!role) {
      await env.CFR_ADMINS.put(rlKey, String(attempts + 1), { expirationTtl: WINDOW_SECONDS });
      return json({ ok: false }, 401);
    }

    if (attempts > 0) await env.CFR_ADMINS.delete(rlKey);
    return json({ ok: true, role });
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
  }
}

// Hashes both sides to a fixed-length digest before comparing, so neither the
// length nor the byte-by-byte match of the raw key leaks through timing.
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
