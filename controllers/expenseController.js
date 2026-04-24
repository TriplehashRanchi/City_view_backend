const expenseModel = require("../models/expenseModel");
const { handleValidationErrors, parsePagination, toNullableString } = require("../utils/validation");

const safeError = (res, error) => {
  console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Server error",
  });
};

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const normalizeExpensePayload = (body, adminId = null) => {
  const gst = body.gst === true || body.gst === 1 || body.gst === "1" || body.gst === "true";
  const amount = Number(body.amount);
  const taxPercentageValue =
    body.taxPercentage === undefined || body.taxPercentage === null || String(body.taxPercentage).trim() === ""
      ? null
      : Number(body.taxPercentage);

  if (!Number.isFinite(amount) || amount < 0) {
    throw badRequest("Amount must be a non-negative number");
  }

  if (gst) {
    if (taxPercentageValue === null || !Number.isFinite(taxPercentageValue)) {
      throw badRequest("taxPercentage is required when gst is true");
    }
    if (!body.amountIs) {
      throw badRequest("amountIs is required when gst is true");
    }
  }

  return {
    expenseDate: body.expenseDate,
    categoryName: body.categoryName.trim(),
    vendorName: toNullableString(body.vendorName),
    amount,
    gst,
    gstin: gst ? toNullableString(body.gstin) : null,
    taxPercentage: gst ? taxPercentageValue : null,
    amountIs: gst ? body.amountIs : null,
    invoiceNumber: toNullableString(body.invoiceNumber),
    paymentMode: toNullableString(body.paymentMode),
    status: body.status || "paid",
    receiptUrl: toNullableString(body.receiptUrl),
    notes: toNullableString(body.notes),
    adminId,
  };
};

exports.createExpense = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const expenseId = await expenseModel.createExpense(normalizeExpensePayload(req.body, req.admin.id));
    const expense = await expenseModel.getExpenseById(expenseId);
    return res.status(201).json({ success: true, message: "Expense created", data: expense });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.listExpenses = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await expenseModel.listExpenses({
      search: toNullableString(req.query.search),
      categoryName: toNullableString(req.query.categoryName),
      paymentMode: toNullableString(req.query.paymentMode),
      status: toNullableString(req.query.status),
      dateFrom: toNullableString(req.query.dateFrom),
      dateTo: toNullableString(req.query.dateTo),
      limit,
      offset,
    });

    return res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getExpense = async (req, res) => {
  try {
    const expense = await expenseModel.getExpenseById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
    return res.json({ success: true, data: expense });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updateExpense = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const existing = await expenseModel.getExpenseById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Expense not found" });

    await expenseModel.updateExpense(req.params.id, normalizeExpensePayload(req.body));
    const expense = await expenseModel.getExpenseById(req.params.id);
    return res.json({ success: true, message: "Expense updated", data: expense });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const existing = await expenseModel.getExpenseById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Expense not found" });

    await expenseModel.deleteExpense(req.params.id);
    return res.json({ success: true, message: "Expense deleted" });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getExpenseSummary = async (req, res) => {
  try {
    const summary = await expenseModel.getExpenseSummary({
      dateFrom: toNullableString(req.query.dateFrom),
      dateTo: toNullableString(req.query.dateTo),
    });
    return res.json({ success: true, data: summary });
  } catch (error) {
    return safeError(res, error);
  }
};
