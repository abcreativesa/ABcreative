// Public: serve an uploaded file from KV, with Range support so videos can seek.
// The full file is kept in Cloudflare's edge cache, so playback requests (many small
// Range requests for video) are answered from the cache instead of re-reading KV each time.
export async function onRequestGet({ params, request, env, waitUntil }) {
  const id = String(params.id || '');
  if (!env.CONTENT || !/^[a-f0-9]{8,40}$/.test(id)) return new Response('Not found', { status: 404 });
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(new URL(request.url).origin + '/media/' + id, { method: 'GET' });
  const range = request.headers.get('range');

  let full = cache ? await cache.match(key) : null;
  let buf, base;
  if (full) {
    buf = await full.arrayBuffer();
    base = Object.fromEntries(full.headers);
  } else {
    const { value, metadata } = await env.CONTENT.getWithMetadata('media:' + id, { type: 'arrayBuffer', cacheTtl: 3600 });
    if (!value) return new Response('Not found', { status: 404 });
    buf = value;
    const type = (metadata && metadata.type) || 'application/octet-stream';
    base = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' };
    if (type === 'image/svg+xml') base['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'";
    if (cache) {
      const put = cache.put(key, new Response(buf.slice(0), { headers: { ...base, 'content-length': String(buf.byteLength) } })).catch(() => {});
      if (waitUntil) waitUntil(put);
    }
  }
  delete base['content-length']; delete base['content-range'];
  base['accept-ranges'] = 'bytes';
  const size = buf.byteLength;
  const m = range && range.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
    let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
    if (isNaN(start) || start < 0) start = 0;
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(buf.slice(start, end + 1), { status: 206, headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  return new Response(buf, { headers: { ...base, 'content-length': String(size) } });
}
