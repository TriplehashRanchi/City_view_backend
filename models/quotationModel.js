const db = require("./db");
const catalogModel = require("./catalogModel");
const eventModel = require("./eventModel");
const { resolveLineTotal, computeQuoteTotals } = require("../utils/quotationPricing");

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

const getPackageSelectionLine = async (selection, eventGuestCount, connection) => {
  const pkg = await catalogModel.getPackageById(selection.packageId, connection);
  if (!pkg) throw notFound(`Package ${selection.packageId} not found`);
  if (pkg.status !== "active") throw badRequest(`Package ${pkg.name} is inactive`);

  const guestCount = selection.guestCount || eventGuestCount;
  if (guestCount < pkg.minimum_guest_count) {
    throw badRequest(`Package ${pkg.name} requires at least ${pkg.minimum_guest_count} guests`);
  }

  const quantity = selection.quantity || 1;
  const unitPrice = selection.unitPriceOverride ?? pkg.base_price;
  const lineTotal = resolveLineTotal({
    pricingType: pkg.pricing_type,
    unitPrice,
    quantity,
    guestCount,
  });

  return {
    source_type: "package",
    catalog_type: "package",
    catalog_id: pkg.id,
    item_name: pkg.name,
    item_description: pkg.description,
    quantity,
    guest_count: guestCount,
    pricing_type: pkg.pricing_type,
    unit_price: unitPrice,
    line_total: lineTotal,
    unit_label: selection.unitLabel || null,
  };
};

const getCatalogLine = async ({ item, type, eventGuestCount, connection }) => {
  const getter = type === "product" ? catalogModel.getProductById : catalogModel.getServiceById;
  const record = await getter(item.catalogId);
  if (!record) throw notFound(`${type} ${item.catalogId} not found`);
  if (record.status !== "active") throw badRequest(`${type} ${record.name} is inactive`);

  const pricingType = type === "product" ? record.pricing_type : record.pricing_type;
  const unitPrice = item.unitPriceOverride ?? (type === "product" ? record.unit_price : record.cost_value);
  const guestCount = item.guestCount || eventGuestCount;
  const quantity = item.quantity || 1;
  const lineTotal = resolveLineTotal({
    pricingType,
    unitPrice,
    quantity,
    guestCount,
  });

  return {
    source_type: type,
    catalog_type: type,
    catalog_id: record.id,
    item_name: record.name,
    item_description: item.descriptionOverride || record.description,
    quantity,
    guest_count: pricingType === "per_person" ? guestCount : 0,
    pricing_type: pricingType,
    unit_price: unitPrice,
    line_total: lineTotal,
    unit_label: item.unitLabel || null,
  };
};

const getManualLine = (item, eventGuestCount) => {
  const guestCount = item.guestCount || eventGuestCount;
  const lineTotal = resolveLineTotal({
    pricingType: item.pricingType,
    unitPrice: item.unitPrice,
    quantity: item.quantity || 1,
    guestCount,
  });

  return {
    source_type: "custom",
    catalog_type: "custom",
    catalog_id: null,
    item_name: item.name,
    item_description: item.description || null,
    quantity: item.quantity || 1,
    guest_count: item.pricingType === "per_person" ? guestCount : 0,
    pricing_type: item.pricingType,
    unit_price: item.unitPrice,
    line_total: lineTotal,
    unit_label: item.unitLabel || null,
  };
};

const buildResolvedLineItems = async ({ eventRecord, selectedPackages = [], customItems = [], connection }) => {
  const lineItems = [];

  for (const selection of selectedPackages) {
    lineItems.push(await getPackageSelectionLine(selection, eventRecord.guest_count, connection));
  }

  for (const item of customItems) {
    if (item.catalogType === "product") {
      lineItems.push(await getCatalogLine({ item, type: "product", eventGuestCount: eventRecord.guest_count, connection }));
    } else if (item.catalogType === "service") {
      lineItems.push(await getCatalogLine({ item, type: "service", eventGuestCount: eventRecord.guest_count, connection }));
    } else {
      lineItems.push(getManualLine(item, eventRecord.guest_count));
    }
  }

  if (!lineItems.length) throw badRequest("At least one package or line item is required");
  return lineItems;
};

const generateQuoteCode = async (connection) => {
  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM quotations");
  const nextNumber = Number(rows[0].total) + 1;
  return `QT-${String(nextNumber).padStart(6, "0")}`;
};

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

    const quoteCode = await generateQuoteCode(connection);
    const [result] = await connection.query(
      "INSERT INTO quotations (event_id, quote_code, created_by) VALUES (?, ?, ?)",
      [eventId, quoteCode, adminId]
    );

    await connection.query("UPDATE events SET event_status = 'quoted' WHERE id = ? AND event_status = 'enquiry'", [eventId]);
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
  termsAndConditions,
  internalNotes,
  customerNotes,
  selectedPackages,
  customItems,
  discountType,
  discountValue,
  manualAdjustment,
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

    const lineItems = await buildResolvedLineItems({
      eventRecord,
      selectedPackages,
      customItems,
      connection,
    });

    const totals = computeQuoteTotals({
      lineItems,
      discountType,
      discountValue,
      manualAdjustment,
    });

    const versionNumber = Number(quotation.current_version_number) + 1;
    const pricingSummary = {
      eventId: eventRecord.id,
      guestCount: eventRecord.guest_count,
      totalLineItems: lineItems.length,
    };

    const [versionResult] = await connection.query(
      `INSERT INTO quotation_versions (
        quotation_id, version_number, status, valid_until, terms_and_conditions, internal_notes, customer_notes,
        subtotal_amount, discount_type, discount_value, discount_amount, manual_adjustment, final_amount,
        pricing_summary_json, cloned_from_version_id, created_by
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotationId,
        versionNumber,
        validUntil,
        termsAndConditions,
        internalNotes,
        customerNotes,
        totals.subtotalAmount,
        discountType,
        discountValue || 0,
        totals.discountAmount,
        totals.manualAdjustment,
        totals.finalAmount,
        JSON.stringify(pricingSummary),
        clonedFromVersionId,
        adminId,
      ]
    );

    for (let index = 0; index < lineItems.length; index += 1) {
      const item = lineItems[index];
      await connection.query(
        `INSERT INTO quotation_version_line_items (
          quotation_version_id, source_type, catalog_type, catalog_id, item_name, item_description,
          quantity, guest_count, pricing_type, unit_price, line_total, unit_label, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          versionResult.insertId,
          item.source_type,
          item.catalog_type,
          item.catalog_id,
          item.item_name,
          item.item_description,
          item.quantity,
          item.guest_count,
          item.pricing_type,
          item.unit_price,
          item.line_total,
          item.unit_label,
          index + 1,
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

    const [lineRows] = await connection.query(
      "SELECT * FROM quotation_version_line_items WHERE quotation_version_id = ? ORDER BY sort_order ASC",
      [versionId]
    );

    const [quotationRows] = await connection.query("SELECT * FROM quotations WHERE id = ? LIMIT 1", [version.quotation_id]);
    const quotation = quotationRows[0];
    if (!quotation) throw notFound("Quotation not found");
    if (quotation.current_status === "accepted") throw badRequest("Accepted quotations cannot be cloned");

    const newVersionNumber = Number(quotation.current_version_number) + 1;
    const [result] = await connection.query(
      `INSERT INTO quotation_versions (
        quotation_id, version_number, status, valid_until, terms_and_conditions, internal_notes, customer_notes,
        subtotal_amount, discount_type, discount_value, discount_amount, manual_adjustment, final_amount,
        pricing_summary_json, cloned_from_version_id, created_by
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotation.id,
        newVersionNumber,
        version.valid_until,
        version.terms_and_conditions,
        version.internal_notes,
        version.customer_notes,
        version.subtotal_amount,
        version.discount_type,
        version.discount_value,
        version.discount_amount,
        version.manual_adjustment,
        version.final_amount,
        version.pricing_summary_json,
        version.id,
        adminId,
      ]
    );

    for (const line of lineRows) {
      await connection.query(
        `INSERT INTO quotation_version_line_items (
          quotation_version_id, source_type, catalog_type, catalog_id, item_name, item_description,
          quantity, guest_count, pricing_type, unit_price, line_total, unit_label, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          line.source_type,
          line.catalog_type,
          line.catalog_id,
          line.item_name,
          line.item_description,
          line.quantity,
          line.guest_count,
          line.pricing_type,
          line.unit_price,
          line.line_total,
          line.unit_label,
          line.sort_order,
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

exports.updateQuotationVersionStatus = async ({ versionId, status, adminId, notes }) => {
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
      expired: "expired_at",
      draft: null,
    }[status];

    let noteValue = version.internal_notes || null;
    if (notes) noteValue = notes;

    if (timestampColumn) {
      await connection.query(
        `UPDATE quotation_versions SET status = ?, internal_notes = ?, ${timestampColumn} = NOW() WHERE id = ?`,
        [status, noteValue, versionId]
      );
    } else {
      await connection.query("UPDATE quotation_versions SET status = ?, internal_notes = ? WHERE id = ?", [status, noteValue, versionId]);
    }

    await connection.query(
      "UPDATE quotations SET current_status = ?, latest_version_id = ? WHERE id = ?",
      [status, versionId, quotation.id]
    );

    if (status === "accepted") {
      await connection.query(
        `UPDATE events
         SET event_status = 'confirmed', confirmation_date = NOW(), accepted_price = ?, accepted_quote_version_id = ?
         WHERE id = ?`,
        [version.final_amount, versionId, quotation.event_id]
      );

      await connection.query(
        `INSERT INTO booking_records (event_id, quotation_id, accepted_quote_version_id, confirmation_date, accepted_price, notes, created_by)
         VALUES (?, ?, ?, NOW(), ?, ?, ?)
         ON DUPLICATE KEY UPDATE accepted_price = VALUES(accepted_price), notes = VALUES(notes), created_by = VALUES(created_by)`,
        [quotation.event_id, quotation.id, versionId, version.final_amount, noteValue, adminId]
      );

      await connection.query("UPDATE quotations SET accepted_version_id = ? WHERE id = ?", [versionId, quotation.id]);
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
    `SELECT id, version_number, status, valid_until, subtotal_amount, discount_amount, final_amount, created_at
     FROM quotation_versions
     WHERE quotation_id = ?
     ORDER BY version_number DESC`,
    [quotationId]
  );

  return { ...rows[0], versions };
};

exports.getQuotationVersionById = async (versionId) => {
  const [rows] = await db.query(
    `SELECT qv.*, q.quote_code, q.event_id, e.occasion_type, e.event_date, e.start_time, e.end_time, e.guest_count, e.venue,
            c.name AS client_name, c.email AS client_email, c.phone AS client_phone
     FROM quotation_versions qv
     INNER JOIN quotations q ON q.id = qv.quotation_id
     INNER JOIN events e ON e.id = q.event_id
     INNER JOIN clients c ON c.id = e.client_id
     WHERE qv.id = ?
     LIMIT 1`,
    [versionId]
  );
  if (!rows[0]) return null;

  const [lineItems] = await db.query(
    `SELECT id, source_type, catalog_type, catalog_id, item_name, item_description, quantity, guest_count,
            pricing_type, unit_price, line_total, unit_label, sort_order
     FROM quotation_version_line_items
     WHERE quotation_version_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [versionId]
  );

  return { ...rows[0], lineItems };
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
