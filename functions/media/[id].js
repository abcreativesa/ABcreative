// Public: serve an uploaded file from KV, with Range support so videos can seek.
export async function onRequestGet({ params, request, env }) {
  const id = String(params.id || '');
  if (!env.CONTENT || !/^[a-f0-9]{8,40}$/.test(id)) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.CONTENT.getWithMetadata('media:' + id, { type: 'arrayBuffer', cacheTtl: 3600 });
  if (!value) return new Response('Not found', { status: 404 });
  const type = (metadata && metadata.type) || 'application/octet-stream';
  const size = value.byteLength;
  const base = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' };
  if (type === 'image/svg+xml') base['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'";
  const range = request.headers.get('range');
  const m = range && range.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
    let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
    if (isNaN(start) || start < 0) start = 0;
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(value.slice(start, end + 1), { status: 206, headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  return new Response(value, { headers: { ...base, 'content-length': String(size) } });
}
