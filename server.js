require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("./db");

const app = express();
app.set("trust proxy", 1);

app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

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

const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "محاولات كثيرة جدًا، حاول مجددًا بعد 15 دقيقة." }, standardHeaders: true, legacyHeaders: false });
const leadLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: { error: "طلبات كثيرة جدًا، حاول مجددًا بعد قليل." }, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: "محاولات كثيرة جدًا، حاول مجددًا بعد 15 دقيقة." }, standardHeaders: true, legacyHeaders: false });

function checkAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_KEY) return res.status(401).json({ error: "مفتاح إداري غير صحيح." });
  next();
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "الرجاء تسجيل الدخول." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "جلسة الدخول منتهية أو غير صالحة." });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch {}
  }
  next();
}

function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { name, email, password } = req.body || {};
  const mail = (email || "").trim().toLowerCase();

  if (!name?.trim()) return res.status(400).json({ error: "الاسم مطلوب." });
  if (!mail || !mail.includes("@")) return res.status(400).json({ error: "بريد إلكتروني غير صالح." });
  if (!password || password.length < 6) return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." });

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(mail);
  if (exists) return res.status(409).json({ error: "هذا البريد مسجّل من قبل." });

  const passwordHash = await bcrypt.hash(password, 12);
  const info = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run(name.trim(), mail, passwordHash);
  const user =
