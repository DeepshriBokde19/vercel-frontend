
require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "20kb" }));
// Backend Home Route
app.get("/", (req, res) => {
  res.send(`
    <h1>ALPHA ENGINEERING</h1>
    <h2>Backend is Running Successfully!</h2>
    <p>Server is active on port 5000.</p>
  `);
});

const otpSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const otpVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const enquiryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: (process.env.EMAIL_APP_PASSWORD || "").replace(/\s/g, ""),
  },
});

// In-memory storage is suitable for local testing. Restarting the backend clears OTPs.
const otpChallenges = new Map();
const verifiedEmails = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFIED_TTL_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function hashOtp(email, otp) {
  if (!process.env.OTP_SECRET) throw new Error("OTP_SECRET is missing in backend/.env");
  return crypto.createHmac("sha256", process.env.OTP_SECRET).update(`${email}:${otp}`).digest("hex");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function safeCompareHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function validateEnquiry(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body?.email);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!name || !email || !phone || !message) return { ok: false, message: "Please fill all fields." };
  if (!isValidEmail(email)) return { ok: false, message: "Please enter a valid email address." };
  if (name.length > 100 || email.length > 254 || phone.length > 30 || message.length > 5000) return { ok: false, message: "One or more fields are too long." };
  return { ok: true, name, email, phone, message };
}

app.get("/api/health", (_req, res) => res.json({ message: "Alpha Engineering backend is running." }));

// STEP 1: OTP recipient = customer's email entered in the form.
app.post("/api/send-otp", otpSendLimiter, async (req, res) => {
  const customerEmail = normalizeEmail(req.body?.email);
  if (!isValidEmail(customerEmail) || customerEmail.length > 254) return res.status(400).json({ message: "Please enter a valid email address." });
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD || !process.env.OTP_SECRET) {
    console.error("Missing EMAIL_USER, EMAIL_APP_PASSWORD, or OTP_SECRET in backend/.env");
    return res.status(500).json({ message: "Email service is not configured. Check backend/.env." });
  }
  const previous = otpChallenges.get(customerEmail);
  if (previous && Date.now() - previous.lastSentAt < 60 * 1000) return res.status(429).json({ message: "Please wait 60 seconds before requesting another OTP." });

  try {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const info = await transporter.sendMail({
      from: `"Alpha Engineering" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: "Alpha Engineering - Email Verification OTP",
      text: `Your Alpha Engineering verification OTP is ${otp}. It expires in 5 minutes. If you did not request it, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#222"><h2>Alpha Engineering</h2><p>Your email verification code is:</p><h1 style="letter-spacing:8px;color:#f97316">${otp}</h1><p>This OTP expires in 5 minutes.</p><p>If you did not request it, ignore this email.</p></div>`,
    });
    otpChallenges.set(customerEmail, { otpHash: hashOtp(customerEmail, otp), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, lastSentAt: Date.now() });
    verifiedEmails.delete(customerEmail);
    console.log("OTP accepted for customer email:", customerEmail, "accepted:", info.accepted);
    return res.json({ message: "OTP sent to your entered email address." });
  } catch (error) {
    console.error("OTP email error:", error.message);
    otpChallenges.delete(customerEmail);
    return res.status(500).json({ message: "Could not send OTP. Check Gmail App Password and try again." });
  }
});

// STEP 2: Verify the OTP entered by the customer.
app.post("/api/verify-otp", otpVerifyLimiter, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ message: "Enter a valid email and six-digit OTP." });
  const challenge = otpChallenges.get(email);
  if (!challenge) return res.status(400).json({ message: "Please request a new OTP first." });
  if (Date.now() > challenge.expiresAt) {
    otpChallenges.delete(email);
    return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
  }
  challenge.attempts += 1;
  if (challenge.attempts > MAX_OTP_ATTEMPTS) {
    otpChallenges.delete(email);
    return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
  }
  if (!safeCompareHex(challenge.otpHash, hashOtp(email, otp))) return res.status(400).json({ message: "Incorrect OTP. Please try again." });
  otpChallenges.delete(email);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  verifiedEmails.set(email, { tokenHash: hashToken(verificationToken), expiresAt: Date.now() + VERIFIED_TTL_MS });
  return res.json({ message: "Email verified successfully.", verificationToken, expiresInSeconds: VERIFIED_TTL_MS / 1000 });
});

// STEP 3: Enquiry recipient = Alpha Engineering company inbox.
app.post("/api/contact", enquiryLimiter, async (req, res) => {
  const fields = validateEnquiry(req.body || {});
  if (!fields.ok) return res.status(400).json({ message: fields.message });
  const { name, email, phone, message } = fields;
  const token = typeof req.body?.verificationToken === "string" ? req.body.verificationToken : "";
  const verification = verifiedEmails.get(email);
  if (!verification || Date.now() > verification.expiresAt) {
    verifiedEmails.delete(email);
    return res.status(403).json({ message: "Please verify your email before submitting the enquiry." });
  }
  if (!token || !safeCompareHex(verification.tokenHash, hashToken(token))) return res.status(403).json({ message: "Email verification is invalid. Please verify again." });
  if (!process.env.RECEIVER_EMAIL) return res.status(500).json({ message: "Set RECEIVER_EMAIL in backend/.env." });

  try {
    await transporter.sendMail({
      from: `"Alpha Engineering Website" <${process.env.EMAIL_USER}>`,
      to: process.env.RECEIVER_EMAIL,
      replyTo: email,
      subject: `New enquiry from ${name}`,
      text: `Name: ${name}\nCustomer email: ${email}\nPhone: ${phone}\n\nMessage:\n${message}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222"><h2>New website enquiry - Alpha Engineering</h2><p><b>Name:</b> ${escapeHtml(name)}</p><p><b>Customer email:</b> ${escapeHtml(email)}</p><p><b>Phone:</b> ${escapeHtml(phone)}</p><p><b>Message:</b><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p></div>`,
    });
    verifiedEmails.delete(email);
    console.log("Enquiry delivered to company inbox. Customer:", email);
    return res.json({ message: "Your enquiry has been sent successfully to Alpha Engineering." });
  } catch (error) {
    console.error("Enquiry email error:", error.message);
    return res.status(500).json({ message: "Enquiry could not be sent. Please try again." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Alpha Engineering backend running at http://localhost:${PORT}`));







