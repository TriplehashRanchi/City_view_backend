const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const adminModel = require("../models/adminModel");
const { signToken } = require("../utils/jwt");

const safeError = (res, status, message) =>
  res.status(status).json({ success: false, message });

exports.registerAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Validation error", errors: errors.array() });
    }

    const { name, email, phone, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await adminModel.findByEmail(normalizedEmail);
    if (existing) return safeError(res, 409, "Email already registered");

    const passwordHash = await bcrypt.hash(password, 12);

    const adminId = await adminModel.createAdmin({
      name,
      email: normalizedEmail,
      phone,
      passwordHash,
    });

    const token = signToken({ id: adminId });

    return res.json({
      success: true,
      message: "Admin registered",
      token,
      admin: { id: adminId, name, email: normalizedEmail, phone: phone || null },
    });
  } catch (err) {
    console.error("registerAdmin error:", err);
    return safeError(res, 500, "Server error");
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Validation error", errors: errors.array() });
    }

    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const admin = await adminModel.findByEmail(normalizedEmail);
    // Avoid leaking whether email exists
    if (!admin) return safeError(res, 401, "Invalid credentials");

    if (admin.status !== "active") return safeError(res, 403, "Account disabled");

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return safeError(res, 401, "Invalid credentials");

    await adminModel.updateLastLogin(admin.id);

    const token = signToken({ id: admin.id });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
      },
    });
  } catch (err) {
    console.error("loginAdmin error:", err);
    return safeError(res, 500, "Server error");
  }
};

exports.me = async (req, res) => {
  return res.json({
    success: true,
    admin: req.admin, // already safe fields from middleware
  });
};
