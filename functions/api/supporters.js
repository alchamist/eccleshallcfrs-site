// Supporters list shown on sponsors.html ("Our Supporters").
//   GET  — public, returns the list (falls back to DEFAULTS until an admin first saves a change)
//   POST — admin only, { action: 'add' | 'remove', ... }
// Logos are uploaded via /api/upload (R2); this endpoint only stores the list in KV.
const KV_KEY = 'cfg:supporters';

// What sponsors.html showed before this list became editable. Served until the first add/remove,
// which persists the full list (defaults included) so nothing is lost.
const DEFAULTS = [
  {
    id: 'nlcf',
    name: 'The National Lottery Community Fund',
    logo: 'images/nlcf-logo.png',
    url: '',
    caption: '',
    dark: false
  },
  {
    id: 'gentili',
    name: 'Gentili',
    logo: 'https://gentili.uk.com/wp-content/uploads/2025/03/Gentili-white-o.png',
    url: 'https://gentili.uk.com/',
    caption: 'Proud supporter of Eccleshall CFRs',
    dark: true
  }
];

export async function onRequestGet({ env }) {
  return json({ ok: true, supporters: await loadSupporters(env) });
}

export async function onRequestPost({ request, env }) {
  try {
    const { username, key, action, supporter, id } = await request.json();

    const role = await getRole(env, username, key);
    if (!role) return json({ ok: false, error: 'Unauthorised' }, 401);
    if (role !== 'admin') return json({ ok: false, error: 'Admin access required' }, 403);

    const supporters = await loadSupporters(env);

    if (action === 'add') {
      const clean = validateSupporter(supporter);
      if (clean.error) return json({ ok: false, error: clean.error }, 400);
      supporters.push({ id: crypto.randomUUID(), ...clean.value });
      await env.CFR_ADMINS.put(KV_KEY, JSON.stringify(supporters));
      return json({ ok: true, supporters });
    }

    if (action === 'remove') {
      if (!id) return json({ ok: false, error: 'Missing supporter id' }, 400);
      const remaining = supporters.filter(s => s.id !== id);
      if (remaining.length === supporters.length) return json({ ok: false, error: 'Supporter not found' }, 404);
      await env.CFR_ADMINS.put(KV_KEY, JSON.stringify(remaining));
      return json({ ok: true, supporters: remaining });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

async function loadSupporters(env) {
  const stored = await env.CFR_ADMINS.get(KV_KEY);
  if (stored === null) return DEFAULTS.map(s => ({ ...s }));
  try {
    const list = JSON.parse(stored);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function validateSupporter(s) {
  if (!s || typeof s !== 'object') return { error: 'Missing supporter details' };
  const name    = String(s.name    || '').trim();
  const logo    = String(s.logo    || '').trim();
  const url     = String(s.url     || '').trim();
  const caption = String(s.caption || '').trim();

  if (!name || name.length > 100) return { error: 'Name is required (100 characters max)' };
  if (caption.length > 120) return { error: 'Caption must be 120 characters or fewer' };
  // Logo: absolute https URL (e.g. the media bucket) or a path to a file shipped in this repo's images/ folder.
  if (!isUrl(logo, ['https:']) && !(/^images\/[\w./-]+$/.test(logo) && !logo.includes('..'))) {
    return { error: 'Logo must be an https:// URL — upload an image or paste a link' };
  }
  // Website is optional, but must be http(s) if given — it ends up in an href on the public page.
  if (url && !isUrl(url, ['http:', 'https:'])) return { error: 'Website must start with http:// or https://' };

  return { value: { name, logo, url, caption, dark: s.dark === true } };
}

function isUrl(value, protocols) {
  try { return protocols.includes(new URL(value).protocol); } catch { return false; }
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
