const db = require("./db");

const allowedSortColumns = {
  products: {
    name: "p.name",
    category_name: "pc.name",
    base_price: "p.base_price",
    created_at: "p.created_at",
    updated_at: "p.updated_at",
  },
  packages: ["name", "per_person_price", "created_at", "updated_at"],
  categories: ["sort_order", "name", "created_at", "updated_at"],
};

const buildFilterQuery = ({ table, search, status, categoryId, foodType, sortBy = "created_at", sortOrder = "DESC" }) => {
  const conditions = [];
  const params = [];

  if (status) {
    if (table === "products") {
      conditions.push("p.status = ?");
    } else {
      conditions.push("status = ?");
    }
    params.push(status);
  }

  if (search) {
    if (table === "products") {
      conditions.push("(p.name LIKE ? OR p.description LIKE ? OR pc.name LIKE ? OR pc.slug LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      conditions.push("(name LIKE ? OR description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
  }

  if (categoryId && table === "products") {
  conditions.push("p.category_id = ?");
  params.push(categoryId);
}

if (foodType && table === "products") {
  conditions.push("p.food_type = ?");
  params.push(foodType);
} 

  const allowed = allowedSortColumns[table] || ["created_at"];
  const orderColumn =
    table === "products"
      ? allowed[sortBy] || allowed.created_at
      : allowed.includes(sortBy)
        ? sortBy
        : "created_at";
  const orderDirection = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return { whereClause, params, orderColumn, orderDirection };
};

exports.listCategories = async ({ search, status, sortBy, sortOrder, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search) {
    conditions.push("(name LIKE ? OR slug LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const allowed = allowedSortColumns.categories;
  const orderColumn = allowed.includes(sortBy) ? sortBy : "sort_order";
  const orderDirection = String(sortOrder).toUpperCase() === "DESC" ? "DESC" : "ASC";
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT id, name, slug, status, sort_order, created_at, updated_at
     FROM product_categories
     ${whereClause}
     ORDER BY ${orderColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM product_categories ${whereClause}`, params);
  return { rows, total: countRows[0].total };
};

exports.getCategoryById = async (id, connection = db) => {
  const [rows] = await connection.query("SELECT * FROM product_categories WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

exports.createCategory = async ({ name, slug, status, sortOrder }) => {
  const [result] = await db.query(
    `INSERT INTO product_categories (name, slug, status, sort_order)
     VALUES (?, ?, ?, ?)`,
    [name, slug, status, sortOrder]
  );
  return result.insertId;
};

exports.updateCategory = async (id, payload) => {
  await db.query(
    `UPDATE product_categories
     SET name = ?, slug = ?, status = ?, sort_order = ?
     WHERE id = ?`,
    [payload.name, payload.slug, payload.status, payload.sortOrder, id]
  );
};

exports.listProducts = async ({ search, status, categoryId, foodType, sortBy, sortOrder, limit, offset }) => {
 const { whereClause, params, orderColumn, orderDirection } = buildFilterQuery({
  table: "products",
  search,
  status,
  categoryId,
  foodType,
  sortBy,
  sortOrder,
});

  const [rows] = await db.query(
    `SELECT p.id, p.name, p.image_url, p.category_id, pc.name AS category_name, pc.slug AS category_slug,
            p.food_type, p.base_price, p.description, p.status, p.created_at, p.updated_at
     FROM products p
     INNER JOIN product_categories pc ON pc.id = p.category_id
     ${whereClause}
     ORDER BY ${orderColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM products p
     INNER JOIN product_categories pc ON pc.id = p.category_id
     ${whereClause}`,
    params
  );
  return { rows, total: countRows[0].total };
};

exports.getProductById = async (id, connection = db) => {
  const [rows] = await connection.query(
    `SELECT p.*, pc.name AS category_name, pc.slug AS category_slug
     FROM products p
     INNER JOIN product_categories pc ON pc.id = p.category_id
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

exports.getProductsByIds = async (ids, connection = db) => {
  const normalizedIds = [...new Set((ids || []).map((id) => Number(id)).filter((id) => id > 0))];
  if (!normalizedIds.length) return [];

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT p.id, p.name, p.image_url, p.category_id, pc.name AS category_name, pc.slug AS category_slug,
            p.food_type, p.base_price, p.description, p.status
     FROM products p
     INNER JOIN product_categories pc ON pc.id = p.category_id
     WHERE p.id IN (${placeholders})
     ORDER BY FIELD(p.id, ${placeholders})`,
    [...normalizedIds, ...normalizedIds]
  );

  return rows;
};

exports.createProduct = async ({ name, imageUrl, categoryId, foodType, basePrice, description, status, adminId }) => {
  const [result] = await db.query(
    `INSERT INTO products (name, image_url, category_id, food_type, base_price, description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, imageUrl, categoryId, foodType, basePrice, description, status, adminId]
  );
  return result.insertId;
};

exports.updateProduct = async (id, payload) => {
  await db.query(
    `UPDATE products
     SET name = ?, image_url = ?, category_id = ?, food_type = ?, base_price = ?, description = ?, status = ?
     WHERE id = ?`,
    [payload.name, payload.imageUrl, payload.categoryId, payload.foodType, payload.basePrice, payload.description, payload.status, id]
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
    `SELECT id, name, description, per_person_price, status, created_at, updated_at
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
    `SELECT pp.id, pp.product_id, pp.sort_order, p.name, p.image_url, p.category_id, pc.name AS category_name, pc.slug AS category_slug,
            p.food_type, p.base_price, p.description, p.status
     FROM package_products pp
     INNER JOIN products p ON p.id = pp.product_id
     INNER JOIN product_categories pc ON pc.id = p.category_id
     WHERE pp.package_id = ?
     ORDER BY pp.sort_order ASC, pp.id ASC`,
    [id]
  );

  return { ...rows[0], products };
};

const normalizePackageProducts = (products = []) => {
  const normalized = [];
  const seen = new Set();

  for (let index = 0; index < (products || []).length; index += 1) {
    const productId = Number(products[index]?.productId);
    if (!Number.isFinite(productId) || productId <= 0 || seen.has(productId)) continue;

    seen.add(productId);
    normalized.push({
      productId,
      sortOrder: Number(products[index]?.sortOrder) > 0 ? Number(products[index].sortOrder) : index + 1,
    });
  }

  return normalized;
};

const assertProductsExist = async (connection, items) => {
  const productIds = items.map((item) => item.productId);
  if (!productIds.length) return;

  const records = await exports.getProductsByIds(productIds, connection);
  const foundIds = new Set(records.map((row) => Number(row.id)));
  const missingId = productIds.find((id) => !foundIds.has(id));

  if (missingId) {
    const error = new Error(`Product ${missingId} not found`);
    error.statusCode = 400;
    throw error;
  }
};

exports.createPackage = async ({ name, description, perPersonPrice, status, adminId, products }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const normalizedProducts = normalizePackageProducts(products);
    await assertProductsExist(connection, normalizedProducts);

    const [result] = await connection.query(
      `INSERT INTO packages (name, description, per_person_price, status, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [name, description, perPersonPrice, status, adminId]
    );

    for (const item of normalizedProducts) {
      await connection.query(
        "INSERT INTO package_products (package_id, product_id, sort_order) VALUES (?, ?, ?)",
        [result.insertId, item.productId, item.sortOrder]
      );
    }

    await connection.commit();
    return result.insertId;
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

    const normalizedProducts = normalizePackageProducts(payload.products);
    await assertProductsExist(connection, normalizedProducts);

    await connection.query(
      `UPDATE packages
       SET name = ?, description = ?, per_person_price = ?, status = ?
       WHERE id = ?`,
      [payload.name, payload.description, payload.perPersonPrice, payload.status, id]
    );

    await connection.query("DELETE FROM package_products WHERE package_id = ?", [id]);

    for (const item of normalizedProducts) {
      await connection.query(
        "INSERT INTO package_products (package_id, product_id, sort_order) VALUES (?, ?, ?)",
        [id, item.productId, item.sortOrder]
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
