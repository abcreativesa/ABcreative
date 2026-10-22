// Visitor stats in D1 (binding: DB). Table is created on first use.
let ready = false;
export async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS hits (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, type TEXT NOT NULL, path TEXT, country TEXT, city TEXT, device TEXT, ref TEXT, vid TEXT, lang TEXT, extra TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS hits_day ON hits(day)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS hits_ts ON hits(ts)`),
  ]);
  ready = true;
}
