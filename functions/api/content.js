import { json, isAdmin, sameOrigin } from '../_lib/auth.js';
// GET: live site content (falls back to the bundled default file). PUT: admin saves new content.
export async function onRequestGet({ env, request }) {
  if (env.CONTENT) {
    const saved = await env.CONTENT.get('content', 'text');
    if (saved) return new Response(saved, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
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
