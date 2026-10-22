import { json, isAdmin, sameOrigin } from '../_lib/auth.js';
// Admin: list uploaded files (GET) or delete one (DELETE ?id=...).
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
  if (!env.CONTENT) return json({ items: [] });
  const items = []; let cursor;
  do {
    const page = await env.CONTENT.list({ prefix: 'media:', cursor });
    page.keys.forEach(k => items.push({ id: k.name.slice(6), ...(k.metadata || {}) }));
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return json({ items, totalBytes: items.reduce((a, b) => a + (b.size || 0), 0) });
}
export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env)) || !sameOrigin(request)) return json({ error: 'unauthorized' }, 401);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[a-f0-9]{8,40}$/.test(id)) return json({ error: 'bad_id' }, 400);
  await env.CONTENT.delete('media:' + id);
  return json({ ok: true });
}
