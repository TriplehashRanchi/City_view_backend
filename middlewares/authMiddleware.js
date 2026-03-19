const jwt = require("jsonwebtoken");
const adminModel = require("../models/adminModel");

exports.requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await adminModel.findById(decoded.id);
    if (!admin) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (admin.status !== "active")
      return res.status(403).json({ success: false, message: "Account disabled" });

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};