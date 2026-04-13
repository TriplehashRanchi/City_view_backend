const db = require("./db");
const catalogModel = require("./catalogModel");
const eventModel = require("./eventModel");
const { computeQuoteTotals } = require("../utils/quotationPricing");

const notFound = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const parseJson = (value) => {
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
};

const formatQuoteCode = (id) => `QT-${String(Number(id)).padStart(6, "0")}`;

const buildClientSnapshot = (eventRecord) => ({
  id: eventRecord.client_id,
  name: eventRecord.client_name,
  phone: eventRecord.client_phone,
  email: eventRecord.client_email,
  companyName: eventRecord.client_company_name,
});

const buildEventSnapshot = (eventRecord, guestCountOverride = null) => ({
  id: eventRecord.id,
  occasionType: eventRecord.occasion_type,
  eventDate: eventRecord.event_date,
  startTime: eventRecord.start_time,
  endTime: eventRecord.end_time,
  guestCount: guestCountOverride || eventRecord.guest_count,
  venue: eventRecord.venue,
  notes: eventRecord.notes,
});

const buildVersionItems = async ({ sourcePackageId, productIds = [], excludedProductIds = [], customItems = [], connection }) => {
  const items = [];
  const seenProductIds = new Set();
  const excludedSet = new Set((excludedProductIds || []).map((id) => Number(id)).filter((id) => id > 0));
  let sortOrder = 1;

  if (sourcePackageId) {
    const pkg = await catalogModel.getPackageById(sourcePackageId, connection);
    if (!pkg) throw notFound("Package not found");
    if (pkg.status !== "active") throw badRequest("Selected package is inactive");

    for (const product of pkg.products || []) {
      const productId = Number(product.product_id);
      if (excludedSet.has(productId)) continue;
      if (seenProductIds.has(productId)) continue;
      seenProductIds.add(productId);
      items.push({
        itemType: "product",
        productId,
        itemName: product.name,
        itemCategory: product.category_name,
        foodType: product.food_type,
        isCustom: 0,
        description: product.description || null,
        sortOrder: sortOrder++,
      });
    }
  }

  const explicitProducts = await catalogModel.getProductsByIds(productIds, connection);
  const foundExplicitIds = new Set(explicitProducts.map((row) => Number(row.id)));

  for (const inputId of productIds || []) {
    const numericId = Number(inputId);
    if (!foundExplicitIds.has(numericId)) {
      throw badRequest(`Product ${numericId} not found`);
    }
  }

  for (const product of explicitProducts) {
    const productId = Number(product.id);
    if (seenProductIds.has(productId)) continue;
    if (product.status !== "active") throw badRequest(`Product ${product.name} is inactive`);

    seenProductIds.add(productId);
    items.push({
      itemType: "product",
      productId,
      itemName: product.name,
      itemCategory: product.category_name,
      foodType: product.food_type,
      isCustom: 0,
      description: product.description || null,
      sortOrder: sortOrder++,
    });
  }

  for (const item of customItems || []) {
    const name = String(item?.name || "").trim();
    if (!name) throw badRequest("Custom item name is required");

    items.push({
      itemType: "custom",
      productId: null,
      itemName: name,
      itemCategory: null,
      foodType: null,
      isCustom: 1,
      description: item.description ? String(item.description).trim() : null,
      sortOrder: sortOrder++,
    });
  }

  if (!items.length) {
    throw badRequest("At least one product or custom item is required");
  }

  return items;
};

const shouldDisplayAsPackage = ({ sourcePackageId, productIds = [], excludedProductIds = [], customItems = [] }) =>
  Boolean(
    sourcePackageId &&
      (!productIds || productIds.length === 0) &&
      (!excludedProductIds || excludedProductIds.length === 0) &&
      (!customItems || customItems.length === 0)
  );

exports.createQuotation = async ({ eventId, adminId }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const eventRecord = await eventModel.getEventById(eventId, connection);
    if (!eventRecord) throw notFound("Event not found");

    const [existingRows] = await connection.query("SELECT * FROM quotations WHERE event_id = ? LIMIT 1", [eventId]);
    if (existingRows[0]) {
      await connection.commit();
      return existingRows[0].id;
    }

    const provisionalQuoteCode = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [result] = await connection.query(
      "INSERT INTO quotations (event_id, quote_code, created_by) VALUES (?, ?, ?)",
      [eventId, provisionalQuoteCode, adminId]
    );

    const quoteCode = formatQuoteCode(result.insertId);
    await connection.query("UPDATE quotations SET quote_code = ? WHERE id = ?", [quoteCode, result.insertId]);
    await connection.query(
      "UPDATE events SET event_status = 'quotation_created' WHERE id = ? AND event_status = 'enquiry'",
      [eventId]
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.createQuotationVersion = async ({
  quotationId,
  validUntil,
  notes,
  termsAndConditions,
  sourcePackageId,
  productIds,
  excludedProductIds,
  customItems,
  perPersonPrice,
  guestCount,
  discountType,
  discountValue,
  adminId,
  clonedFromVersionId = null,
}) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [quotationRows] = await connection.query("SELECT * FROM quotations WHERE id = ? LIMIT 1", [quotationId]);
    const quotation = quotationRows[0];
    if (!quotation) throw notFound("Quotation not found");
    if (quotation.current_status === "accepted") throw badRequest("Accepted quotations cannot be revised");

    const eventRecord = await eventModel.getEventById(quotation.event_id, connection);
    if (!eventRecord) throw notFound("Event not found");

    const normalizedGuestCount = Number(guestCount || eventRecord.guest_count);
    const items = await buildVersionItems({
      sourcePackageId,
      productIds,
      excludedProductIds,
      customItems,
      connection,
    });

    const totals = computeQuoteTotals({
      perPersonPrice,
      guestCount: normalizedGuestCount,
      discountType,
      discountValue,
    });

    const clientSnapshot = buildClientSnapshot(eventRecord);
    const eventSnapshot = buildEventSnapshot(eventRecord, normalizedGuestCount);
    const versionNumber = Number(quotation.current_version_number) + 1;
    const displayAsPackage = shouldDisplayAsPackage({
      sourcePackageId,
      productIds,
      excludedProductIds,
      customItems,
    });

    const [versionResult] = await connection.query(
      `INSERT INTO quotation_versions (
        quotation_id, version_number, status, valid_until, source_package_id, display_as_package, client_snapshot_json, event_snapshot_json,
        per_person_price, guest_count, subtotal_amount, discount_type, discount_value, discount_amount,
        final_amount, notes, terms_and_conditions, cloned_from_version_id, created_by
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotationId,
        versionNumber,
        validUntil,
        sourcePackageId,
        displayAsPackage ? 1 : 0,
        JSON.stringify(clientSnapshot),
        JSON.stringify(eventSnapshot),
        perPersonPrice,
        normalizedGuestCount,
        totals.subtotalAmount,
        discountType,
        discountValue || 0,
        totals.discountAmount,
        totals.finalAmount,
        notes,
        termsAndConditions,
        clonedFromVersionId,
        adminId,
      ]
    );

    for (const item of items) {
      await connection.query(
        `INSERT INTO quotation_version_items (
          quotation_version_id, item_type, product_id, item_name, item_category, food_type, is_custom, description, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          versionResult.insertId,
          item.itemType,
          item.productId,
          item.itemName,
          item.itemCategory,
          item.foodType,
          item.isCustom,
          item.description,
          item.sortOrder,
        ]
      );
    }

    await connection.query(
      `UPDATE quotations
       SET current_version_number = ?, latest_version_id = ?, current_status = 'draft'
       WHERE id = ?`,
      [versionNumber, versionResult.insertId, quotationId]
    );

    await connection.commit();
    return versionResult.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.cloneQuotationVersion = async ({ versionId, adminId }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [versionRows] = await connection.query("SELECT * FROM quotation_versions WHERE id = ? LIMIT 1", [versionId]);
    const version = versionRows[0];
    if (!version) throw notFound("Quotation version not found");

    const [itemRows] = await connection.query(
      "SELECT * FROM quotation_version_items WHERE quotation_version_id = ? ORDER BY sort_order ASC, id ASC",
      [versionId]
    );

    const [quotationRows] = await connection.query("SELECT * FROM quotations WHERE id = ? LIMIT 1", [version.quotation_id]);
    const quotation = quotationRows[0];
    if (!quotation) throw notFound("Quotation not found");
    if (quotation.current_status === "accepted") throw badRequest("Accepted quotations cannot be cloned");

    const newVersionNumber = Number(quotation.current_version_number) + 1;
    const [result] = await connection.query(
      `INSERT INTO quotation_versions (
        quotation_id, version_number, status, valid_until, source_package_id, display_as_package, client_snapshot_json, event_snapshot_json,
        per_person_price, guest_count, subtotal_amount, discount_type, discount_value, discount_amount,
        final_amount, notes, terms_and_conditions, cloned_from_version_id, created_by
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotation.id,
        newVersionNumber,
        version.valid_until,
        version.source_package_id,
        version.display_as_package,
        version.client_snapshot_json,
        version.event_snapshot_json,
        version.per_person_price,
        version.guest_count,
        version.subtotal_amount,
        version.discount_type,
        version.discount_value,
        version.discount_amount,
        version.final_amount,
        version.notes,
        version.terms_and_conditions,
        version.id,
        adminId,
      ]
    );

    for (const item of itemRows) {
      await connection.query(
        `INSERT INTO quotation_version_items (
          quotation_version_id, item_type, product_id, item_name, item_category, food_type, is_custom, description, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          item.item_type,
          item.product_id,
          item.item_name,
          item.item_category,
          item.food_type,
          item.is_custom,
          item.description,
          item.sort_order,
        ]
      );
    }

    await connection.query(
      "UPDATE quotations SET current_version_number = ?, latest_version_id = ?, current_status = 'draft' WHERE id = ?",
      [newVersionNumber, result.insertId, quotation.id]
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.updateQuotationVersionStatus = async ({ versionId, status }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [versionRows] = await connection.query("SELECT * FROM quotation_versions WHERE id = ? LIMIT 1", [versionId]);
    const version = versionRows[0];
    if (!version) throw notFound("Quotation version not found");

    const [quotationRows] = await connection.query("SELECT * FROM quotations WHERE id = ? LIMIT 1", [version.quotation_id]);
    const quotation = quotationRows[0];
    if (!quotation) throw notFound("Quotation not found");

    if (quotation.current_status === "accepted" && status !== "accepted") {
      throw badRequest("Accepted quotations cannot be moved to another status");
    }

    const timestampColumn = {
      sent: "sent_at",
      accepted: "accepted_at",
      rejected: "rejected_at",
      draft: null,
    }[status];

    if (timestampColumn) {
      await connection.query(
        `UPDATE quotation_versions SET status = ?, ${timestampColumn} = NOW() WHERE id = ?`,
        [status, versionId]
      );
    } else {
      await connection.query("UPDATE quotation_versions SET status = ? WHERE id = ?", [status, versionId]);
    }

    await connection.query(
      "UPDATE quotations SET current_status = ?, latest_version_id = ? WHERE id = ?",
      [status, versionId, quotation.id]
    );

    if (status === "accepted") {
      await connection.query("UPDATE quotations SET accepted_version_id = ? WHERE id = ?", [versionId, quotation.id]);
      await connection.query("UPDATE events SET event_status = 'confirmed' WHERE id = ?", [quotation.event_id]);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.getQuotationById = async (quotationId) => {
  const [rows] = await db.query(
    `SELECT q.*, e.occasion_type, e.event_date, e.start_time, e.end_time, e.guest_count, e.venue,
            c.name AS client_name, c.email AS client_email, c.phone AS client_phone
     FROM quotations q
     INNER JOIN events e ON e.id = q.event_id
     INNER JOIN clients c ON c.id = e.client_id
     WHERE q.id = ?
     LIMIT 1`,
    [quotationId]
  );
  if (!rows[0]) return null;

  const [versions] = await db.query(
    `SELECT id, version_number, status, valid_until, per_person_price, guest_count, subtotal_amount, discount_amount, final_amount, created_at
     FROM quotation_versions
     WHERE quotation_id = ?
     ORDER BY version_number DESC`,
    [quotationId]
  );

  return { ...rows[0], versions };
};

exports.getQuotationVersionById = async (versionId) => {
  const [rows] = await db.query(
    `SELECT qv.*, q.quote_code, q.event_id
     FROM quotation_versions qv
     INNER JOIN quotations q ON q.id = qv.quotation_id
     WHERE qv.id = ?
     LIMIT 1`,
    [versionId]
  );
  if (!rows[0]) return null;

  let sourcePackage = null;
  if (rows[0].source_package_id) {
    sourcePackage = await catalogModel.getPackageById(rows[0].source_package_id);
  }

  const [items] = await db.query(
    `SELECT id, item_type, product_id, item_name, item_category, food_type, is_custom, description, sort_order
     FROM quotation_version_items
     WHERE quotation_version_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [versionId]
  );

  return {
    ...rows[0],
    client_snapshot: parseJson(rows[0].client_snapshot_json),
    event_snapshot: parseJson(rows[0].event_snapshot_json),
    source_package: sourcePackage
      ? {
          id: sourcePackage.id,
          name: sourcePackage.name,
          per_person_price: sourcePackage.per_person_price,
        }
      : null,
    items,
  };
};

exports.listQuotationsByEvent = async (eventId) => {
  const [rows] = await db.query(
    `SELECT id, quote_code, current_version_number, current_status, latest_version_id, accepted_version_id, created_at, updated_at
     FROM quotations
     WHERE event_id = ?
     ORDER BY created_at DESC`,
    [eventId]
  );
  return rows;
};

exports.getDashboardReport = async () => {
  const [[metrics]] = await db.query(
    `SELECT
        (SELECT COUNT(*) FROM events) AS total_events,
        (SELECT COUNT(*) FROM quotations) AS total_quotations,
        (SELECT COUNT(*) FROM quotation_versions WHERE status = 'accepted') AS accepted_quotations,
        (SELECT COUNT(*) FROM events WHERE event_status = 'confirmed') AS confirmed_bookings,
        (SELECT IFNULL(SUM(final_amount), 0) FROM quotation_versions WHERE status = 'accepted') AS accepted_revenue`
  );

  const [statusBreakdown] = await db.query(
    `SELECT status, COUNT(*) AS total
     FROM quotation_versions
     GROUP BY status`
  );

  const [upcomingEvents] = await db.query(
    `SELECT e.id, e.occasion_type, e.event_date, e.start_time, e.venue, e.event_status, c.name AS client_name
     FROM events e
     INNER JOIN clients c ON c.id = e.client_id
     WHERE e.event_date >= CURDATE()
     ORDER BY e.event_date ASC, e.start_time ASC
     LIMIT 10`
  );

  return { metrics, statusBreakdown, upcomingEvents };
};
