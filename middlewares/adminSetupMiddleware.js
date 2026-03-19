const crypto = require("crypto");

function safeEqual(a, b) {
  const first = Buffer.from(String(a || ""), "utf8");
  const second = Buffer.from(String(b || ""), "utf8");
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}

exports.requireAdminSetupKey = (req, res, next) => {
  const setupKey = process.env.ADMIN_SETUP_KEY;
  const incomingKey = req.header("x-admin-setup-key");
  const isProduction = process.env.NODE_ENV === "production";

  // In local/dev, always allow Postman registration.
  if (!isProduction) {
    return next();
  }

  if (!setupKey) {
    return res.status(503).json({
      success: false,
      message: "Admin registration is disabled. Configure ADMIN_SETUP_KEY in production.",
    });
  }

  if (!incomingKey || !safeEqual(incomingKey, setupKey)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden. Valid x-admin-setup-key is required in production.",
    });
  }

  next();
};
