const db = require("./db");
const { resolveLineTotal } = require("../utils/quotationPricing");

const allowedSortColumns = {
  products: ["name", "category", "unit_price", "created_at", "updated_at"],
  services: ["name", "cost_value", "created_at", "updated_at"],
  packages: ["name", "base_price", "minimum_guest_count", "created_at", "updated_at"],
};

const buildFilterQuery = ({ table, search, status, category, sortBy = "created_at", sortOrder = "DESC" }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search) {
    conditions.push("(name LIKE ? OR description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category && table === "products") {
    conditions.push("category = ?");
    params.push(category);
  }

  const allowed = allowedSortColumns[table] || ["created_at"];
  const orderColumn = allowed.includes(sortBy) ? sortBy : "created_at";
  const orderDirection = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return { whereClause, params, orderColumn, orderDirection };
};

exports.listProducts = async ({ search, status, category, sortBy, sortOrder, limit, offset }) => {
  const { whereClause, params, orderColumn, orderDirection } = buildFilterQuery({
    table: "products",
    search,
    status,
    category,
    sortBy,
    sortOrder,
  });

  const [rows] = await db.query(
    `SELECT id, name, category, food_type, unit_price, pricing_type, description, status, created_at, updated_at
     FROM products
     ${whereClause}
     ORDER BY ${orderColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM products ${whereClause}`, params);
  return { rows, total: countRows[0].total };
};

exports.getProductById = async (id) => {
  const [rows] = await db.query("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

exports.createProduct = async ({ name, category, foodType, unitPrice, pricingType, description, status, adminId }) => {
  const [result] = await db.query(
    `INSERT INTO products (name, category, food_type, unit_price, pricing_type, description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, foodType, unitPrice, pricingType, description, status, adminId]
  );
  return result.insertId;
};

exports.updateProduct = async (id, payload) => {
  await db.query(
    `UPDATE products
     SET name = ?, category = ?, food_type = ?, unit_price = ?, pricing_type = ?, description = ?, status = ?
     WHERE id = ?`,
    [payload.name, payload.category, payload.foodType, payload.unitPrice, payload.pricingType, payload.description, payload.status, id]
  );
};

exports.listServices = async ({ search, status, sortBy, sortOrder, limit, offset }) => {
  const { whereClause, params, orderColumn, orderDirection } = buildFilterQuery({
    table: "services",
    search,
    status,
    sortBy,
    sortOrder,
  });

  const [rows] = await db.query(
    `SELECT id, name, pricing_type, cost_value, description, status, created_at, updated_at
     FROM services
     ${whereClause}
     ORDER BY ${orderColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM services ${whereClause}`, params);
  return { rows, total: countRows[0].total };
};

exports.getServiceById = async (id) => {
  const [rows] = await db.query("SELECT * FROM services WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

exports.createService = async ({ name, pricingType, costValue, description, status, adminId }) => {
  const [result] = await db.query(
    `INSERT INTO services (name, pricing_type, cost_value, description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, pricingType, costValue, description, status, adminId]
  );
  return result.insertId;
};

exports.updateService = async (id, payload) => {
  await db.query(
    `UPDATE services
     SET name = ?, pricing_type = ?, cost_value = ?, description = ?, status = ?
     WHERE id = ?`,
    [payload.name, payload.pricingType, payload.costValue, payload.description, payload.status, id]
  );
};

exports.listPackages = async ({ search, status, sortBy, sortOrder, limit, offset }) => {
  const { whereClause, params, orderColumn, orderDirection } = buildFilterQuery({
    table: "packages",
    search,
    status,
    sortBy,
    sortOrder,
  });

  const [rows] = await db.query(
    `SELECT id, name, description, pricing_type, base_price, minimum_guest_count, status, created_at, updated_at
     FROM packages
     ${whereClause}
     ORDER BY ${orderColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM packages ${whereClause}`, params);
  return { rows, total: countRows[0].total };
};

exports.getPackageById = async (id, connection = db) => {
  const [rows] = await connection.query("SELECT * FROM packages WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) return null;

  const [products] = await connection.query(
    `SELECT pp.id, pp.product_id, pp.quantity, pp.notes, p.name, p.category, p.unit_price, p.pricing_type, p.status
     FROM package_products pp
     INNER JOIN products p ON p.id = pp.product_id
     WHERE pp.package_id = ?
     ORDER BY pp.id ASC`,
    [id]
  );
  const [services] = await connection.query(
    `SELECT ps.id, ps.service_id, ps.quantity, ps.notes, s.name, s.cost_value, s.pricing_type, s.status
     FROM package_services ps
     INNER JOIN services s ON s.id = ps.service_id
     WHERE ps.package_id = ?
     ORDER BY ps.id ASC`,
    [id]
  );

  return { ...rows[0], products, services };
};

const buildCatalogMap = async ({ connection, table, idColumn, ids }) => {
  if (!ids.length) return new Map();

  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT * FROM ${table} WHERE ${idColumn} IN (${placeholders})`,
    ids
  );

  return new Map(rows.map((row) => [String(row.id), row]));
};

const normalizePackageItems = (items = [], idKey) => {
  const mergedItems = new Map();

  for (const item of items || []) {
    const recordId = Number(item?.[idKey]);
    if (!Number.isFinite(recordId) || recordId <= 0) continue;

    if (mergedItems.has(recordId)) {
      const existing = mergedItems.get(recordId);
      existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
      existing.notes = existing.notes || item.notes || null;
      continue;
    }

    mergedItems.set(recordId, {
      ...item,
      [idKey]: recordId,
      quantity: Number(item.quantity || 0),
      notes: item.notes || null,
    });
  }

  return Array.from(mergedItems.values()).filter((item) => item.quantity > 0);
};

const computePackageBasePrice = async ({ connection, minimumGuestCount, products, services }) => {
  const guestCount = Number(minimumGuestCount ?? 1);
  const productIds = [...new Set(products.map((item) => Number(item.productId)).filter(Boolean))];
  const serviceIds = [...new Set(services.map((item) => Number(item.serviceId)).filter(Boolean))];
  const productMap = await buildCatalogMap({ connection, table: "products", idColumn: "id", ids: productIds });
  const serviceMap = await buildCatalogMap({ connection, table: "services", idColumn: "id", ids: serviceIds });

  let total = 0;

  for (const item of products) {
    const product = productMap.get(String(item.productId));
    if (!product) {
      const error = new Error(`Product ${item.productId} not found`);
      error.statusCode = 400;
      throw error;
    }

    total += resolveLineTotal({
      pricingType: product.pricing_type,
      unitPrice: product.unit_price,
      quantity: item.quantity,
      guestCount,
    });
  }

  for (const item of services) {
    const service = serviceMap.get(String(item.serviceId));
    if (!service) {
      const error = new Error(`Service ${item.serviceId} not found`);
      error.statusCode = 400;
      throw error;
    }

    total += resolveLineTotal({
      pricingType: service.pricing_type,
      unitPrice: service.cost_value,
      quantity: item.quantity,
      guestCount,
    });
  }

  return Math.round((Number(total) + Number.EPSILON) * 100) / 100;
};

exports.createPackage = async ({ name, description, minimumGuestCount, status, adminId, products, services }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const normalizedProducts = normalizePackageItems(products, "productId");
    const normalizedServices = normalizePackageItems(services, "serviceId");
    const computedBasePrice = await computePackageBasePrice({
      connection,
      minimumGuestCount,
      products: normalizedProducts,
      services: normalizedServices,
    });

    const [result] = await connection.query(
      `INSERT INTO packages (name, description, pricing_type, base_price, minimum_guest_count, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description, "fixed", computedBasePrice, minimumGuestCount ?? 1, status, adminId]
    );

    const packageId = result.insertId;

    for (const item of normalizedProducts) {
      await connection.query(
        "INSERT INTO package_products (package_id, product_id, quantity, notes) VALUES (?, ?, ?, ?)",
        [packageId, item.productId, item.quantity, item.notes || null]
      );
    }

    for (const item of normalizedServices) {
      await connection.query(
        "INSERT INTO package_services (package_id, service_id, quantity, notes) VALUES (?, ?, ?, ?)",
        [packageId, item.serviceId, item.quantity, item.notes || null]
      );
    }

    await connection.commit();
    return packageId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.updatePackage = async (id, payload) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const normalizedProducts = normalizePackageItems(payload.products, "productId");
    const normalizedServices = normalizePackageItems(payload.services, "serviceId");
    const computedBasePrice = await computePackageBasePrice({
      connection,
      minimumGuestCount: payload.minimumGuestCount,
      products: normalizedProducts,
      services: normalizedServices,
    });

    await connection.query(
      `UPDATE packages
       SET name = ?, description = ?, pricing_type = ?, base_price = ?, minimum_guest_count = ?, status = ?
       WHERE id = ?`,
      [payload.name, payload.description, "fixed", computedBasePrice, payload.minimumGuestCount ?? 1, payload.status, id]
    );
    await connection.query("DELETE FROM package_products WHERE package_id = ?", [id]);
    await connection.query("DELETE FROM package_services WHERE package_id = ?", [id]);

    for (const item of normalizedProducts) {
      await connection.query(
        "INSERT INTO package_products (package_id, product_id, quantity, notes) VALUES (?, ?, ?, ?)",
        [id, item.productId, item.quantity, item.notes || null]
      );
    }
    for (const item of normalizedServices) {
      await connection.query(
        "INSERT INTO package_services (package_id, service_id, quantity, notes) VALUES (?, ?, ?, ?)",
        [id, item.serviceId, item.quantity, item.notes || null]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
