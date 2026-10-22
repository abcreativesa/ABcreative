// Shared helpers: signed session cookie (HMAC-SHA256), JSON responses.
const enc = new TextEncoder();
const COOKIE = 'abc_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

function secretOf(env) {
  return env.SESSION_SECRET || ('abc::' + (env.ADMIN_PASSWORD || '') + '::' + (env.ADMIN_USER || ''));
}
async function hmac(env, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secretOf(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export function credentialsOk(env, user, pass) {
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return false;
  return safeEqual(String(user || ''), env.ADMIN_USER) & safeEqual(String(pass || ''), env.ADMIN_PASSWORD) ? true : false;
}
export async function makeCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${env.ADMIN_USER}.${exp}`;
  const token = `${exp}.${await hmac(env, payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function isAdmin(request, env) {
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(env, `${env.ADMIN_USER}.${exp}`));
}
// Mutating requests must come from our own admin page (header can't be set cross-site without CORS).
export const sameOrigin = request => request.headers.get('x-abc-admin') === '1';
export const needKV = env => !env.CONTENT;
