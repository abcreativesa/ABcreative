import { ensure } from '../_lib/db.js';
import { isAdmin } from '../_lib/auth.js';
// Public beacon: one row per page view / WhatsApp click / brief / work opened. No cookies, no IPs stored.
const TYPES = new Set(['view', 'wa', 'brief', 'work', 'social']);
const ok = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
function refName(r, self) {
  try {
    const h = new URL(r).hostname.replace(/^www\./, '');
    if (!h || h === self) return '';
    if (/tiktok/.test(h)) return 'TikTok';
    if (/instagram/.test(h)) return 'Instagram';
    if (/facebook|fb\./.test(h)) return 'Facebook';
    if (/google\./.test(h)) return 'Google';
    if (/(^|\.)t\.co$|twitter|x\.com/.test(h)) return 'X';
    if (/snapchat/.test(h)) return 'Snapchat';
    if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp';
    if (/linkedin/.test(h)) return 'LinkedIn';
    if (/youtube/.test(h)) return 'YouTube';
    return h.slice(0, 60);
  } catch (e) { return ''; }
}
// In-app browsers (TikTok, Instagram, Snapchat...) send no referrer, so read the source from utm_source or the user agent.
function appName(ua, u) {
  const n = refName('https://' + String(u || '').toLowerCase().replace(/[^a-z0-9.]/g, '') + '.x', '');
  if (u && n && !/\.x$/.test(n)) return n;
  if (u) return String(u).slice(0, 40);
  if (/musical_ly|bytedancewebview|tiktok|trill/i.test(ua)) return 'TikTok';
  if (/instagram/i.test(ua)) return 'Instagram';
  if (/fban|fbav|fb_iab|fbios/i.test(ua)) return 'Facebook';
  if (/snapchat/i.test(ua)) return 'Snapchat';
  if (/twitter/i.test(ua)) return 'X';
  if (/linkedinapp/i.test(ua)) return 'LinkedIn';
  return '';
}
export async function onRequestPost({ request, env }) {
  if (!env.DB) return ok();
  const ua = request.headers.get('user-agent') || '';
  if (/bot|crawl|spider|preview|headless|lighthouse/i.test(ua)) return ok();
  if (await isAdmin(request, env)) return ok(); // don't count yourself
  let b = {};
  try { b = JSON.parse(await request.text()); } catch (e) { return ok(); }
  if (!TYPES.has(b.t)) return ok();
  const cf = request.cf || {};
  const device = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
  const now = Date.now();
  const day = new Date(now + 3 * 3600e3).toISOString().slice(0, 10); // Riyadh day
  try {
    await ensure(env.DB);
    await env.DB.prepare('INSERT INTO hits (ts, day, type, path, country, city, device, ref, vid, lang, extra) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(now, day, b.t, String(b.p || '/').slice(0, 100), cf.country || '', String(cf.city || '').slice(0, 60), device,
        (refName(String(b.r || ''), new URL(request.url).hostname.replace(/^www\./, '')) || appName(ua, b.u)), String(b.v || '').slice(0, 40), b.l === 'en' ? 'en' : 'ar', String(b.x || '').slice(0, 40))
      .run();
  } catch (e) {}
  return ok();
}
