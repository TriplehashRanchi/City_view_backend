const db = require("./db");

exports.findClientById = async (id) => {
  const [rows] = await db.query("SELECT * FROM clients WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

exports.findClientByIdentity = async ({ email, phone }) => {
  const conditions = [];
  const params = [];
  if (email) {
    conditions.push("email = ?");
    params.push(email);
  }
  if (phone) {
    conditions.push("phone = ?");
    params.push(phone);
  }
  if (!conditions.length) return null;

  const [rows] = await db.query(
    `SELECT * FROM clients WHERE ${conditions.join(" OR ")} ORDER BY id ASC LIMIT 1`,
    params
  );
  return rows[0] || null;
};

exports.createClient = async ({ name, phone, email, companyName, notes, adminId }) => {
  const [result] = await db.query(
    `INSERT INTO clients (name, phone, email, company_name, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, phone, email, companyName, notes, adminId]
  );
  return result.insertId;
};

exports.updateClient = async (id, payload) => {
  await db.query(
    `UPDATE clients
     SET name = ?, phone = ?, email = ?, company_name = ?, notes = ?, status = ?
     WHERE id = ?`,
    [payload.name, payload.phone, payload.email, payload.companyName, payload.notes, payload.status, id]
  );
};

exports.listClients = async ({ search, status, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search) {
    conditions.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR company_name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT id, name, phone, email, company_name, notes, status, created_at, updated_at
     FROM clients
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM clients ${whereClause}`, params);
  return { rows, total: countRows[0].total };
};

exports.getClientDetails = async (id) => {
  const client = await exports.findClientById(id);
  if (!client) return null;

  const [events] = await db.query(
    `SELECT id, occasion_type, event_date, start_time, end_time, guest_count, venue, event_status
     FROM events
     WHERE client_id = ?
     ORDER BY event_date DESC, start_time DESC`,
    [id]
  );

  return { ...client, events };
};

exports.createEvent = async ({ clientId, occasionType, eventDate, startTime, endTime, guestCount, venue, notes, adminId }) => {
  const [result] = await db.query(
    `INSERT INTO events (client_id, occasion_type, event_date, start_time, end_time, guest_count, venue, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [clientId, occasionType, eventDate, startTime, endTime, guestCount, venue, notes, adminId]
  );
  return result.insertId;
};

exports.updateEvent = async (id, payload) => {
  await db.query(
    `UPDATE events
     SET client_id = ?, occasion_type = ?, event_date = ?, start_time = ?, end_time = ?, guest_count = ?, venue = ?, notes = ?, event_status = ?
     WHERE id = ?`,
    [
      payload.clientId,
      payload.occasionType,
      payload.eventDate,
      payload.startTime,
      payload.endTime,
      payload.guestCount,
      payload.venue,
      payload.notes,
      payload.eventStatus,
      id,
    ]
  );
};

exports.getEventById = async (id, connection = db) => {
  const [rows] = await connection.query(
    `SELECT e.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.company_name AS client_company_name
     FROM events e
     INNER JOIN clients c ON c.id = e.client_id
     WHERE e.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

exports.listEvents = async ({ search, status, dateFrom, dateTo, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("e.event_status = ?");
    params.push(status);
  }
  if (dateFrom) {
    conditions.push("e.event_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("e.event_date <= ?");
    params.push(dateTo);
  }
  if (search) {
    conditions.push("(c.name LIKE ? OR c.email LIKE ? OR e.occasion_type LIKE ? OR e.venue LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT e.id, e.occasion_type, e.event_date, e.start_time, e.end_time, e.guest_count, e.venue, e.event_status,
            c.name AS client_name, c.phone AS client_phone, c.email AS client_email
     FROM events e
     INNER JOIN clients c ON c.id = e.client_id
     ${whereClause}
     ORDER BY e.event_date DESC, e.start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM events e
     INNER JOIN clients c ON c.id = e.client_id
     ${whereClause}`,
    params
  );

  return { rows, total: countRows[0].total };
};
