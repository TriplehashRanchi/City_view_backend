const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");

const authController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { requireAdminSetupKey } = require("../middlewares/adminSetupMiddleware");

const router = express.Router();

// Rate limit login to reduce brute force
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Try again later." },
});

router.post(
  "/register",
  requireAdminSetupKey,
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name required"),
    body("email").trim().isEmail().withMessage("Valid email required"),
    body("phone").optional().trim().isLength({ min: 8 }).withMessage("Invalid phone"),
    body("password").isLength({ min: 8 }).withMessage("Password must be 8+ chars"),
  ],
  authController.registerAdmin
);

router.post(
  "/login",
  loginLimiter,
  [
    body("email").trim().isEmail().withMessage("Valid email required"),
    body("password").isString().notEmpty().withMessage("Password required"),
  ],
  authController.loginAdmin
);

router.get("/me", requireAuth, authController.me);

module.exports = router;
