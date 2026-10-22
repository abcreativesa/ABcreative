import { json, credentialsOk, makeCookie } from '../_lib/auth.js';
export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return json({ error: 'not_configured' }, 503);
  let body = {};
  try { body = await request.json(); } catch (e) {}
  if (!credentialsOk(env, body.user, body.pass)) {
    await new Promise(r => setTimeout(r, 800));
    return json({ error: 'wrong_credentials' }, 401);
  }
  return json({ ok: true }, 200, { 'set-cookie': await makeCookie(env) });
}
