const { validationResult } = require("express-validator");

exports.handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;

  return res.status(400).json({
    success: false,
    message: "Validation error",
    errors: errors.array(),
  });
};

exports.parsePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || "1000", 10) || 1000, 1), 500);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

exports.toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};
