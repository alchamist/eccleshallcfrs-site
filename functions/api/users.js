export async function onRequestPost({ request, env }) {
  try {
    const { username, key, action, targetUser, targetKey, targetRole } = await request.json();

    const role = await getRole(env, username, key);
    if (!role) return json({ ok: false, error: 'Unauthorised' }, 401);
    if (role !== 'admin') return json({ ok: false, error: 'Admin access required' }, 403);

    if (action === 'list') {
      const { keys } = await env.CFR_ADMINS.list();
      const users = [];
      for (const k of keys) {
        if (k.name.startsWith('cfg:') || k.name.startsWith('ratelimit:')) continue;
        const val = await env.CFR_ADMINS.get(k.name);
        let userRole = 'admin';
        try { userRole = JSON.parse(val).role || 'editor'; } catch {}
        users.push({ username: k.name, role: userRole });
      }
      return json({ ok: true, users });
    }

    if (action === 'create') {
      if (!targetUser || !targetRole) return json({ ok: false, error: 'Missing fields' }, 400);
      if (!['admin', 'editor'].includes(targetRole)) return json({ ok: false, error: 'Invalid role' }, 400);
      const safeUser = targetUser.toLowerCase().trim();
      if (!safeUser || safeUser.startsWith('cfg:') || safeUser.startsWith('ratelimit:')) return json({ ok: false, error: 'Invalid username' }, 400);

      let finalKey = targetKey;
      if (!finalKey) {
        const existing = await env.CFR_ADMINS.get(safeUser);
        if (!existing) return json({ ok: false, error: 'Access key required for new users' }, 400);
        try { finalKey = JSON.parse(existing).key; } catch { finalKey = existing; }
      }

      await env.CFR_ADMINS.put(safeUser, JSON.stringify({ key: finalKey, role: targetRole }));
      return json({ ok: true });
    }

    if (action === 'delete') {
      if (!targetUser) return json({ ok: false, error: 'Missing target user' }, 400);
      if (targetUser.toLowerCase() === username.toLowerCase()) {
        return json({ ok: false, error: 'Cannot delete your own account' }, 400);
      }
      await env.CFR_ADMINS.delete(targetUser.toLowerCase());
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
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
