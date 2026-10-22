import { json, isAdmin } from '../_lib/auth.js';
import { ensure } from '../_lib/db.js';
// Admin: visitor numbers for the dashboard.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'db_missing' }, 503);
  await ensure(env.DB);
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 30));
  const since = new Date(Date.now() + 3 * 3600e3 - (days - 1) * 864e5).toISOString().slice(0, 10);
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const [daily, totals, todayRow, live, countries, devices, refs, events, socials] = await env.DB.batch([
    q(`SELECT day, SUM(type='view') AS views, COUNT(DISTINCT CASE WHEN type='view' THEN vid END) AS visitors FROM hits WHERE day>=? GROUP BY day ORDER BY day`, since),
    q(`SELECT SUM(type='view') AS views, COUNT(DISTINCT CASE WHEN type='view' THEN vid END) AS visitors FROM hits WHERE day>=?`, since),
    q(`SELECT SUM(type='view') AS views, COUNT(DISTINCT CASE WHEN type='view' THEN vid END) AS visitors FROM hits WHERE day=?`, today),
    q(`SELECT COUNT(DISTINCT vid) AS n FROM hits WHERE ts>?`, Date.now() - 5 * 60e3),
    q(`SELECT country AS k, COUNT(DISTINCT vid) AS n FROM hits WHERE type='view' AND day>=? GROUP BY country ORDER BY n DESC LIMIT 8`, since),
    q(`SELECT device AS k, COUNT(DISTINCT vid) AS n FROM hits WHERE type='view' AND day>=? GROUP BY device ORDER BY n DESC`, since),
    q(`SELECT CASE WHEN ref='' THEN 'direct' ELSE ref END AS k, COUNT(*) AS n FROM hits WHERE type='view' AND day>=? GROUP BY k ORDER BY n DESC LIMIT 8`, since),
    q(`SELECT type AS k, COUNT(*) AS n FROM hits WHERE type!='view' AND day>=? GROUP BY type`, since),
    q(`SELECT extra AS k, COUNT(*) AS n FROM hits WHERE type='social' AND day>=? GROUP BY extra ORDER BY n DESC`, since),
  ]);
  return json({
    days, since, today,
    daily: daily.results, totals: totals.results[0] || {}, today_: todayRow.results[0] || {}, live: (live.results[0] || {}).n || 0,
    countries: countries.results, devices: devices.results, refs: refs.results, events: events.results, socials: socials.results,
  });
}
