const db = require("./db");

exports.findByEmail = async (email) => {
  const [rows] = await db.query("SELECT * FROM admins WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
};

exports.findById = async (id) => {
  const [rows] = await db.query(
    "SELECT id, name, email, phone, status, last_login_at, created_at FROM admins WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
};

exports.createAdmin = async ({ name, email, phone, passwordHash }) => {
  const [result] = await db.query(
    "INSERT INTO admins (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
    [name, email, phone || null, passwordHash]
  );
  return result.insertId;
};

exports.updateLastLogin = async (id) => {
  await db.query("UPDATE admins SET last_login_at = NOW() WHERE id = ?", [id]);
};