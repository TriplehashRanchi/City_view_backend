const db = require("./db");

const buildLike = (query) => `%${query}%`;

exports.globalSearch = async ({ query, limit = 5 }) => {
  const like = buildLike(query);
  const safeLimit = Number(limit) > 0 ? Number(limit) : 5;

  const [clients] = await db.query(
    `SELECT id, name, company_name, email, phone, status
     FROM clients
     WHERE name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ?`,
    [like, like, like, like, safeLimit]
  );

  const [events] = await db.query(
    `SELECT e.id, e.occasion_type, e.event_date, e.venue, e.event_status, c.name AS client_name
     FROM events e
     INNER JOIN clients c ON c.id = e.client_id
     WHERE c.name LIKE ? OR e.occasion_type LIKE ? OR e.venue LIKE ? OR e.event_date LIKE ?
     ORDER BY e.event_date DESC, e.start_time DESC
     LIMIT ?`,
    [like, like, like, like, safeLimit]
  );

  const [products] = await db.query(
    `SELECT p.id, p.name, pc.name AS category_name, p.food_type, p.base_price, p.status
     FROM products p
     INNER JOIN product_categories pc ON pc.id = p.category_id
     WHERE p.name LIKE ? OR pc.name LIKE ? OR p.description LIKE ?
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT ?`,
    [like, like, like, safeLimit]
  );

  const [packages] = await db.query(
    `SELECT id, name, per_person_price, status
     FROM packages
     WHERE name LIKE ? OR description LIKE ?
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ?`,
    [like, like, safeLimit]
  );

  const [quotations] = await db.query(
    `SELECT q.id, q.quote_code, q.current_status, q.current_version_number, q.event_id,
            c.name AS client_name, e.occasion_type, e.event_date, e.venue
     FROM quotations q
     INNER JOIN events e ON e.id = q.event_id
     INNER JOIN clients c ON c.id = e.client_id
     WHERE q.quote_code LIKE ? OR c.name LIKE ? OR e.occasion_type LIKE ? OR e.venue LIKE ?
     ORDER BY q.updated_at DESC, q.created_at DESC
     LIMIT ?`,
    [like, like, like, like, safeLimit]
  );

  return {
    clients,
    events,
    products,
    packages,
    quotations,
  };
};
