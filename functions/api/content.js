import { json, isAdmin, sameOrigin } from '../_lib/auth.js';
// GET: live site content (falls back to the bundled default file). PUT: admin saves new content.
// Works added to the bundled defaults after the admin's last save (marked with addedAt) are merged in at their default position,
// so new work pushed to the repo appears even when the admin has saved content before.
async function withNewDefaults(saved, env, request) {
  try {
    const data = JSON.parse(saved);
    const res = await env.ASSETS.fetch(new URL('/content.default.json', request.url));
    const def = await res.json();
    const savedAt = Date.parse(data.updatedAt || 0) || 0;
    const have = new Set((data.works || []).map(w => w.id));
    const removed = new Set(data.removed || []);
    const fresh = (def.works || []).filter(w => w.addedAt && Date.parse(w.addedAt) > savedAt && !have.has(w.id) && !removed.has(w.id));
    if (!fresh.length) return saved;
    // Keep each new work at its place in the defaults: after the nearest earlier default work the admin
    // content already has; works at the very top of the defaults (or with no such neighbour) go on top.
    const works = (data.works || []).slice(), top = [];
    const freshIds = new Set(fresh.map(w => w.id));
    fresh.forEach(w => {
      const di = def.works.findIndex(x => x.id === w.id);
      let anchor = null;
      for (let k = di - 1; k >= 0; k--) { const id = def.works[k].id; if (freshIds.has(id)) break; if (works.some(x => x.id === id)) { anchor = id; break; } }
      if (anchor) { const at = works.findIndex(x => x.id === anchor); works.splice(at + 1, 0, w); } else top.push(w);
    });
    data.works = top.concat(works);
    const heroNew = (def.hero || []).filter(id => fresh.some(w => w.id === id));
    if (heroNew.length && Array.isArray(data.hero)) data.hero = heroNew.concat(data.hero.filter(id => !heroNew.includes(id)));
    return JSON.stringify(data);
  } catch (e) { return saved; }
}
export async function onRequestGet({ env, request }) {
  if (env.CONTENT) {
    const saved = await env.CONTENT.get('content', 'text');
    if (saved) return new Response(await withNewDefaults(saved, env, request), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
  }
  const res = await env.ASSETS.fetch(new URL('/content.default.json', request.url));
  return new Response(res.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
}
export async function onRequestPut({ request, env }) {
  if (!(await isAdmin(request, env)) || !sameOrigin(request)) return json({ error: 'unauthorized' }, 401);
  if (!env.CONTENT) return json({ error: 'storage_missing' }, 503);
  let data;
  try { data = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
  if (!data || !Array.isArray(data.works) || !Array.isArray(data.services)) return json({ error: 'bad_shape' }, 400);
  data.updatedAt = new Date().toISOString();
  const text = JSON.stringify(data);
  if (text.length > 20 * 1024 * 1024) return json({ error: 'too_large' }, 413);
  // keep the previous version as a backup
  const prev = await env.CONTENT.get('content', 'text');
  if (prev) await env.CONTENT.put('content:backup', prev);
  await env.CONTENT.put('content', text);
  return json({ ok: true, updatedAt: data.updatedAt });
}
