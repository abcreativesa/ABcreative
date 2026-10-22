import { json, isAdmin, sameOrigin } from '../_lib/auth.js';
// Admin: undo the last save (swap with backup) or reset to the bundled defaults.
export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env)) || !sameOrigin(request)) return json({ error: 'unauthorized' }, 401);
  if (!env.CONTENT) return json({ error: 'storage_missing' }, 503);
  const { mode } = await request.json().catch(() => ({}));
  if (mode === 'defaults') { await env.CONTENT.delete('content'); return json({ ok: true }); }
  const backup = await env.CONTENT.get('content:backup', 'text');
  if (!backup) return json({ error: 'no_backup' }, 404);
  const cur = await env.CONTENT.get('content', 'text');
  await env.CONTENT.put('content', backup);
  if (cur) await env.CONTENT.put('content:backup', cur);
  return json({ ok: true });
}
