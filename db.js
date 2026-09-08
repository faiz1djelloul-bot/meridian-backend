const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const db = new Database(path.join(__dirname, "realestate.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    listing_type TEXT NOT NULL DEFAULT 'sale',
    price REAL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area_sqft REAL,
    location TEXT,
    description TEXT,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, property_id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    message TEXT,
    property_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const BACKUP_DIR = path.join(__dirname, "backups");
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;

function runBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(BACKUP_DIR, `realestate-${stamp}.db`);
    db.backup(dest)
      .then(() => {
        console.log(`🗄️  نسخة احتياطية جديدة: ${dest}`);
        const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).sort();
        while (files.length > MAX_BACKUPS) {
          fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
        }
      })
      .catch((err) => console.error("فشل النسخ الاحتياطي:", err.message));
  } catch (err) {
    console.error("فشل النسخ الاحتياطي:", err.message);
  }
}

setTimeout(runBackup, 60 * 1000);
setInterval(runBackup, BACKUP_INTERVAL_MS);

module.exports = db;
