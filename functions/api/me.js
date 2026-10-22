import { json, isAdmin } from '../_lib/auth.js';
export async function onRequestGet({ request, env }) {
  return json({ admin: await isAdmin(request, env), configured: !!(env.ADMIN_USER && env.ADMIN_PASSWORD), storage: !!env.CONTENT });
}
