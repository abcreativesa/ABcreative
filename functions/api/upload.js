import { json, isAdmin, sameOrigin } from '../_lib/auth.js';
// Admin uploads one file (image or video, max 25 MB — the KV value limit). Stored in KV under media:<id>.
const MAX = 25 * 1024 * 1024;
const OK = /^(image\/(jpeg|png|webp|gif|avif|svg\+xml)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp3|mp4|aac|wav|x-wav|ogg|x-m4a))$/;
export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env)) || !sameOrigin(request)) return json({ error: 'unauthorized' }, 401);
  if (!env.CONTENT) return json({ error: 'storage_missing' }, 503);
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!OK.test(type)) return json({ error: 'type_not_allowed', type }, 415);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX) return json({ error: 'too_large', max: MAX }, 413);
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX) return json({ error: 'too_large', max: MAX }, 413);
  if (!buf.byteLength) return json({ error: 'empty' }, 400);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await env.CONTENT.put('media:' + id, buf, { metadata: { type, size: buf.byteLength, name: (request.headers.get('x-file-name') || '').slice(0, 120), at: Date.now() } });
  return json({ ok: true, id, url: '/media/' + id, type, size: buf.byteLength });
}
