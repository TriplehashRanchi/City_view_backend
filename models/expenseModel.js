const db = require("./db");

exports.createExpense = async ({
  expenseDate,
  categoryName,
  vendorName,
  amount,
  gst,
  gstin,
  taxPercentage,
  amountIs,
  invoiceNumber,
  paymentMode,
  status,
  receiptUrl,
  notes,
  adminId,
}) => {
  const [result] = await db.query(
    `INSERT INTO restaurant_expenses (
      expense_date, category_name, vendor_name, amount, gst, gstin, tax_percentage, amount_is,
      invoice_number, payment_mode, status, receipt_url, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expenseDate,
      categoryName,
      vendorName,
      amount,
      gst ? 1 : 0,
      gstin,
      taxPercentage,
      amountIs,
      invoiceNumber,
      paymentMode,
      status,
      receiptUrl,
      notes,
      adminId,
    ]
  );
  return result.insertId;
};

exports.updateExpense = async (
  id,
  {
    expenseDate,
    categoryName,
    vendorName,
    amount,
    gst,
    gstin,
    taxPercentage,
    amountIs,
    invoiceNumber,
    paymentMode,
    status,
    receiptUrl,
    notes,
  }
) => {
  await db.query(
    `UPDATE restaurant_expenses
     SET expense_date = ?, category_name = ?, vendor_name = ?, amount = ?, gst = ?, gstin = ?, tax_percentage = ?, amount_is = ?,
         invoice_number = ?, payment_mode = ?, status = ?, receipt_url = ?, notes = ?
     WHERE id = ?`,
    [
      expenseDate,
      categoryName,
      vendorName,
      amount,
      gst ? 1 : 0,
      gstin,
      taxPercentage,
      amountIs,
      invoiceNumber,
      paymentMode,
      status,
      receiptUrl,
      notes,
      id,
    ]
  );
};

exports.deleteExpense = async (id) => {
  const [result] = await db.query("DELETE FROM restaurant_expenses WHERE id = ?", [id]);
  return result.affectedRows;
};

exports.getExpenseById = async (id) => {
  const [rows] = await db.query(
    `SELECT re.*, a.name AS created_by_name
     FROM restaurant_expenses re
     LEFT JOIN admins a ON a.id = re.created_by
     WHERE re.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

exports.listExpenses = async ({ search, categoryName, paymentMode, status, dateFrom, dateTo, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (categoryName) {
    conditions.push("re.category_name = ?");
    params.push(categoryName);
  }
  if (paymentMode) {
    conditions.push("re.payment_mode = ?");
    params.push(paymentMode);
  }
  if (status) {
    conditions.push("re.status = ?");
    params.push(status);
  }
  if (dateFrom) {
    conditions.push("re.expense_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("re.expense_date <= ?");
    params.push(dateTo);
  }
  if (search) {
    conditions.push(
      "(re.category_name LIKE ? OR re.vendor_name LIKE ? OR re.invoice_number LIKE ? OR re.notes LIKE ?)"
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT re.id, re.expense_date, re.category_name, re.vendor_name, re.amount, re.gst, re.tax_percentage, re.amount_is,
            re.invoice_number, re.payment_mode, re.status, re.receipt_url, re.notes, re.created_at, re.updated_at,
            a.name AS created_by_name
     FROM restaurant_expenses re
     LEFT JOIN admins a ON a.id = re.created_by
     ${whereClause}
     ORDER BY re.expense_date DESC, re.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM restaurant_expenses re
     ${whereClause}`,
    params
  );

  return { rows, total: countRows[0].total };
};

exports.getExpenseSummary = async ({ dateFrom, dateTo }) => {
  const conditions = [];
  const params = [];

  if (dateFrom) {
    conditions.push("expense_date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("expense_date <= ?");
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [[metrics]] = await db.query(
    `SELECT
        COUNT(*) AS total_expenses,
        IFNULL(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
        IFNULL(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount,
        IFNULL(SUM(CASE WHEN status = 'cancelled' THEN amount ELSE 0 END), 0) AS cancelled_amount,
        IFNULL(SUM(amount), 0) AS gross_amount
     FROM restaurant_expenses
     ${whereClause}`,
    params
  );

  const [categoryBreakdown] = await db.query(
    `SELECT category_name, COUNT(*) AS total_expenses, IFNULL(SUM(amount), 0) AS total_amount
     FROM restaurant_expenses
     ${whereClause}
     GROUP BY category_name
     ORDER BY total_amount DESC, category_name ASC`,
    params
  );

  const [statusBreakdown] = await db.query(
    `SELECT status, COUNT(*) AS total_expenses, IFNULL(SUM(amount), 0) AS total_amount
     FROM restaurant_expenses
     ${whereClause}
     GROUP BY status
     ORDER BY total_amount DESC, status ASC`,
    params
  );

  return { metrics, categoryBreakdown, statusBreakdown };
};
