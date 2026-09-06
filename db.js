const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "realestate.db"));
db.pragma("journal_mode = WAL");

db.exec(`
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

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    message TEXT,
    property_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
