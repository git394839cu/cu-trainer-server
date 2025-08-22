import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'training.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT UNIQUE,
  date INTEGER,
  from_addr TEXT,
  to_addrs TEXT,
  cc_addrs TEXT,
  subject TEXT,
  text TEXT,
  on_behalf INTEGER,
  creator_name TEXT,
  brand_domain TEXT,
  content_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
`);

export function upsertEmail(row) {
  const stmt = db.prepare(`
    INSERT INTO emails (message_id, date, from_addr, to_addrs, cc_addrs, subject, text, on_behalf, creator_name, brand_domain, content_hash)
    VALUES (@message_id, @date, @from_addr, @to_addrs, @cc_addrs, @subject, @text, @on_behalf, @creator_name, @brand_domain, @content_hash)
    ON CONFLICT(message_id) DO UPDATE SET
      date=excluded.date,
      from_addr=excluded.from_addr,
      to_addrs=excluded.to_addrs,
      cc_addrs=excluded.cc_addrs,
      subject=excluded.subject,
      text=excluded.text,
      on_behalf=excluded.on_behalf,
      creator_name=excluded.creator_name,
      brand_domain=excluded.brand_domain,
      content_hash=excluded.content_hash
  `);
  stmt.run(row);
}

export function fetchExamples({ limit = 3, onBehalf = null, keywords = [], brandDomain = "" }) {
  let where = [];
  let params = {};
  if (onBehalf !== null) { where.push("on_behalf = @ob"); params.ob = onBehalf ? 1 : 0; }
  if (brandDomain)       { where.push("brand_domain = @bd"); params.bd = brandDomain.toLowerCase(); }

  const base = `SELECT subject, text, creator_name, brand_domain, date FROM emails ${
    where.length ? "WHERE " + where.join(" AND ") : ""
  } ORDER BY date DESC LIMIT 200`;

  const rows = db.prepare(base).all(params);

  const kws = (keywords || []).map(k => k.toLowerCase());
  const scored = rows.map(r => {
    const t = (r.text || "").toLowerCase();
    const score = kws.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0)
                  + (brandDomain && r.brand_domain === brandDomain.toLowerCase() ? 1 : 0);
    return { ...r, score };
  }).sort((a,b) => b.score - a.score || b.date - a.date);

  return scored.slice(0, limit);
}
