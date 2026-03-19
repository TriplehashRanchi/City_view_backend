const db = require("./db");

exports.createClient = async (name, phone, email) => {
  const [result] = await db.query(
    "INSERT INTO clients (name, phone, email) VALUES (?, ?, ?)",
    [name, phone, email]
  );

  return result;
};

exports.getClients = async () => {
  const [rows] = await db.query("SELECT * FROM clients");
  return rows;
};