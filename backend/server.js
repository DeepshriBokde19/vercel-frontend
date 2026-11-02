
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

dotenv.config();

const app = express();
app.set("trust proxy", 1);
// ================= MIDDLEWARE =================

// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:5173",
//   })
// );
app.use(
  cors({
    origin: [
      "https://alpha-engineering-website.netlify.app",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);


app.use(express.json({ limit: "20kb" }));


// ================= RATE LIMITING =================

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many OTP requests. Please try again later.",
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many verification attempts. Please try again later.",
  },
});

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

// ================= EMAIL CONFIGURATION =================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// ================= OTP STORAGE =================

// In-memory storage: suitable for local development.
const otpChallenges = new Map();
const verifiedEmails = new Map();

const OTP_EXPIRY = 5 * 60 * 1000;
const VERIFIED_EXPIRY = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// ================= HELPER FUNCTIONS =================

function normalizeEmail(email) {
  return typeof email === "string"
    ? email.trim().toLowerCase()
    : "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashOtp(email, otp) {
  const secret = process.env.OTP_SECRET;

  if (!secret) {
    throw new Error("OTP_SECRET is missing from backend/.env");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`${email}:${otp}`)
    .digest("hex");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function safeCompareHex(first, second) {
  if (
    typeof first !== "string" ||
    typeof second !== "string" ||
    !/^[a-f0-9]{64}$/i.test(first) ||
    !/^[a-f0-9]{64}$/i.test(second)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(first, "hex"),
    Buffer.from(second, "hex")
  );
}

function validateEnquiry(body) {
  const { name, email, phone, message } = body;

  if (
    ![name, email, phone, message].every(
      (value) =>
        typeof value === "string" &&
        value.trim().length > 0
    )
  ) {
    return {
      valid: false,
      message: "Please fill all fields.",
    };
  }

  if (
    name.trim().length > 100 ||
    email.trim().length > 254 ||
    phone.trim().length > 30 ||
    message.trim().length > 5000
  ) {
    return {
      valid: false,
      message: "One or more fields are too long.",
    };
  }

  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      valid: false,
      message: "Please enter a valid email address.",
    };
  }

  return {
    valid: true,
    email: normalizedEmail,
  };
}

// ================= HEALTH CHECK =================

app.get("/api/health", (req, res) => {
  res.json({
    message: "Alpha Engineering backend is running!",
  });
});

// ==================================================
// API 1: SEND OTP TO CUSTOMER'S EMAIL
// POST /api/send-otp
// ==================================================

app.post("/api/send-otp", otpSendLimiter, async (req, res) => {
  // IMPORTANT: Email entered by the customer in the form
  const email = normalizeEmail(req.body?.email);

  // Validate customer's email
  if (!isValidEmail(email) || email.length > 254) {
    return res.status(400).json({
      message: "Please enter a valid email address.",
    });
  }

  // Check required environment variables
  if (
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_APP_PASSWORD ||
    !process.env.OTP_SECRET
  ) {
    console.error("Missing email or OTP configuration in .env");

    return res.status(500).json({
      message: "Email service is not configured properly.",
    });
  }

  try {
    // Prevent repeated OTP requests within 60 seconds
    const existing = otpChallenges.get(email);

    if (
      existing &&
      Date.now() - existing.lastSentAt < 60 * 1000
    ) {
      return res.status(429).json({
        message: "Please wait 60 seconds before requesting another OTP.",
      });
    }

    // Generate six-digit OTP
    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    // Send OTP to the customer's entered email
    await transporter.sendMail({
      from: `"Alpha Engineering" <${process.env.EMAIL_USER}>`,

      // This must be the customer's email, NOT the company's inbox
      to: email,

      subject: "Alpha Engineering - Email Verification OTP",

      text:
        `Your Alpha Engineering verification OTP is ${otp}.\n\n` +
        "This OTP expires in 5 minutes. " +
        "If you did not request it, please ignore this email.",

      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #222;">
          <h2>Alpha Engineering</h2>

          <p>Please use the following code to verify your email address:</p>

          <h1 style="letter-spacing: 8px; color: #f97316;">
            ${otp}
          </h1>

          <p>This OTP expires in <strong>5 minutes</strong>.</p>

          <p>If you did not request this code, please ignore this email.</p>
        </div>
      `,
    });

    // Store OTP after sending email successfully
    otpChallenges.set(email, {
      otpHash: hashOtp(email, otp),
      expiresAt: Date.now() + OTP_EXPIRY,
      attempts: 0,
      lastSentAt: Date.now(),
    });

    // New OTP invalidates previous verification
    verifiedEmails.delete(email);

    console.log("OTP email accepted for customer:", email);

    return res.json({
      message: "OTP sent successfully to your email address.",
    });
  } catch (error) {
    console.error("OTP email error:", error.message);

    otpChallenges.delete(email);

    return res.status(500).json({
      message: "Could not send OTP. Please check your email configuration.",
    });
  }
});

// ==================================================
// API 2: VERIFY OTP
// POST /api/verify-otp
// ==================================================

app.post("/api/verify-otp", otpVerifyLimiter, (req, res) => {
  const email = normalizeEmail(req.body?.email);

  const otp =
    typeof req.body?.otp === "string"
      ? req.body.otp.trim()
      : "";

  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      message: "Enter a valid email and six-digit OTP.",
    });
  }

  const challenge = otpChallenges.get(email);

  if (!challenge) {
    return res.status(400).json({
      message: "Please request a new OTP first.",
    });
  }

  // Check expiry
  if (Date.now() > challenge.expiresAt) {
    otpChallenges.delete(email);

    return res.status(400).json({
      message: "OTP expired. Please request a new OTP.",
    });
  }

  // Limit incorrect attempts
  challenge.attempts += 1;

  if (challenge.attempts > MAX_ATTEMPTS) {
    otpChallenges.delete(email);

    return res.status(429).json({
      message: "Too many incorrect attempts. Request a new OTP.",
    });
  }

  // Compare submitted OTP securely
  const submittedHash = hashOtp(email, otp);

  if (!safeCompareHex(challenge.otpHash, submittedHash)) {
    return res.status(400).json({
      message: "Incorrect OTP. Please try again.",
    });
  }

  // OTP can be used only once
  otpChallenges.delete(email);

  // Generate verification token
  const verificationToken = crypto
    .randomBytes(32)
    .toString("hex");

  verifiedEmails.set(email, {
    tokenHash: hashToken(verificationToken),
    expiresAt: Date.now() + VERIFIED_EXPIRY,
  });

  return res.json({
    message: "Email Verified Successfully!",
    verificationToken,
    expiresInSeconds: Math.floor(VERIFIED_EXPIRY / 1000),
  });
});

// ==================================================
// API 3: SUBMIT ENQUIRY
// POST /api/contact
// ==================================================

app.post("/api/contact", enquiryLimiter, async (req, res) => {
  try {
    const validation = validateEnquiry(req.body || {});

    if (!validation.valid) {
      return res.status(400).json({
        message: validation.message,
      });
    }

    const email = validation.email;

    const verificationToken =
      typeof req.body?.verificationToken === "string"
        ? req.body.verificationToken
        : "";

    const verification = verifiedEmails.get(email);

    // Ensure customer's email has been verified
    if (
      !verification ||
      Date.now() > verification.expiresAt
    ) {
      verifiedEmails.delete(email);

      return res.status(403).json({
        message: "Please verify your email before submitting the enquiry.",
      });
    }

    // Check verification token
    if (
      !verificationToken ||
      !safeCompareHex(
        verification.tokenHash,
        hashToken(verificationToken)
      )
    ) {
      return res.status(403).json({
        message: "Email verification is invalid. Please verify again.",
      });
    }

    // Check company's receiving email
    if (!process.env.RECEIVER_EMAIL) {
      return res.status(500).json({
        message: "Receiver email is not configured in .env.",
      });
    }

    const { name, phone, message } = req.body;

    // Send enquiry to Alpha Engineering's inbox
    await transporter.sendMail({
      from: `"Alpha Engineering Website" <${process.env.EMAIL_USER}>`,

      // Company inbox receives the enquiry
      to: process.env.RECEIVER_EMAIL,

      // Replying to this enquiry will address the customer
      replyTo: email,

      subject: `New enquiry from ${name.trim()}`,

      text:
        `Name: ${name.trim()}\n` +
        `Email: ${email}\n` +
        `Phone: ${phone.trim()}\n\n` +
        `Message:\n${message.trim()}`,
    });

    // One successful enquiry per verification
    verifiedEmails.delete(email);

    return res.json({
      message: "Enquiry submitted successfully!",
    });
  } catch (error) {
    console.error("Enquiry email error:", error.message);

    return res.status(500).json({
      message: "Enquiry could not be sent. Please try again later.",
    });
  }
});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});