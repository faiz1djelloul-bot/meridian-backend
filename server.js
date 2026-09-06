require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const hasEmail = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
const transporter = hasEmail
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

function checkAdmin(req, res, next) {
  const key = req.query.key || req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_KEY) return res.status(401).json({ error: "مفتاح إداري غير صحيح." });
  next();
}

// ---------- PROPERTIES (public read) ----------
app.get("/api/properties", (req, res) => {
  const { type, minPrice, maxPrice, bedrooms } = req.query;
  let rows = db.prepare("SELECT * FROM properties WHERE status != 'hidden' ORDER BY created_at DESC").all();
  if (type) rows = rows.filter((p) => p.listing_type === type);
  if (minPrice) rows = rows.filter((p) => (p.price || 0) >= Number(minPrice));
  if (maxPrice) rows = rows.filter((p) => (p.price || 0) <= Number(maxPrice));
  if (bedrooms) rows = rows.filter((p) => p.bedrooms === Number(bedrooms));
  res.json(rows);
});

// ---------- PROPERTIES (admin write) ----------
app.post("/api/properties", checkAdmin, (req, res) => {
  const { title, listing_type, price, bedrooms, bathrooms, area_sqft, location, description, image_url, status } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: "عنوان العقار مطلوب." });

  const info = db
    .prepare(`INSERT INTO properties (title, listing_type, price, bedrooms, bathrooms, area_sqft, location, description, image_url, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(title.trim(), listing_type || "sale", price || null, bedrooms || null, bathrooms || null, area_sqft || null, location || "", description || "", image_url || "", status || "available");

  res.status(201).json(db.prepare("SELECT * FROM properties WHERE id = ?").get(info.lastInsertRowid));
});

app.put("/api/properties/:id", checkAdmin, (req, res) => {
  const p = db.prepare("SELECT * FROM properties WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "العقار غير موجود." });
  const { title, listing_type, price, bedrooms, bathrooms, area_sqft, location, description, image_url, status } = req.body || {};

  db.prepare(`UPDATE properties SET title=?, listing_type=?, price=?, bedrooms=?, bathrooms=?, area_sqft=?, location=?, description=?, image_url=?, status=? WHERE id=?`)
    .run(title ?? p.title, listing_type ?? p.listing_type, price ?? p.price, bedrooms ?? p.bedrooms, bathrooms ?? p.bathrooms, area_sqft ?? p.area_sqft, location ?? p.location, description ?? p.description, image_url ?? p.image_url, status ?? p.status, p.id);

  res.json(db.prepare("SELECT * FROM properties WHERE id = ?").get(p.id));
});

app.delete("/api/properties/:id", checkAdmin, (req, res) => {
  db.prepare("DELETE FROM properties WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- LEADS ----------
app.post("/api/leads", async (req, res) => {
  const { name, phone, email, message, propertyId } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "الاسم مطلوب." });

  const info = db
    .prepare("INSERT INTO leads (name, phone, email, message, property_id) VALUES (?, ?, ?, ?, ?)")
    .run(name.trim(), phone || "", email || "", message || "", propertyId || null);

  if (transporter && process.env.AGENT_EMAIL) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.AGENT_EMAIL,
        subject: `New property inquiry — ${name.trim()}`,
        text: `New lead:\n\nName: ${name.trim()}\nPhone: ${phone || "—"}\nEmail: ${email || "—"}\nProperty ID: ${propertyId || "—"}\nMessage: ${message || "—"}`,
      });
    } catch (err) {
      console.error("Email send failed:", err.message);
    }
  }

  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.get("/api/leads", checkAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all());
});

app.get("/api/health", (req, res) => res.json({ ok: true, email: hasEmail }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ سيرفر العقارات يعمل على http://localhost:${PORT}`));
