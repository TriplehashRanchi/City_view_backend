const express = require("express");
const { body, param, query } = require("express-validator");
const expenseController = require("../controllers/expenseController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);

const expenseValidation = [
  body("expenseDate").isISO8601(),
  body("categoryName").trim().isLength({ min: 2, max: 150 }),
  body("vendorName").optional({ nullable: true }).trim().isLength({ min: 0, max: 150 }),
  body("amount").isFloat({ min: 0 }),
  body("gst").custom((value) => {
    if ([true, false, "true", "false", "1", "0", 1, 0].includes(value)) return true;
    throw new Error("gst must be a boolean");
  }),
  body("gstin").optional({ nullable: true }).trim().isLength({ min: 0, max: 15 }),
  body("taxPercentage").optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body("amountIs").optional({ nullable: true }).isIn(["inclusive", "exclusive"]),
  body("invoiceNumber").optional({ nullable: true }).trim().isLength({ min: 0, max: 100 }),
  body("paymentMode").optional({ nullable: true }).isIn(["cash", "upi", "card", "bank", "credit"]),
  body("status").optional().isIn(["paid", "pending", "cancelled"]),
  body("receiptUrl").optional({ nullable: true }).isString().isLength({ min: 0, max: 255 }),
  body("notes").optional({ nullable: true }).isString().isLength({ min: 0, max: 500 }),
];

router.post("/", expenseValidation, expenseController.createExpense);
router.get(
  "/",
  [
    query("paymentMode").optional().isIn(["cash", "upi", "card", "bank", "credit"]),
    query("status").optional().isIn(["paid", "pending", "cancelled"]),
    query("dateFrom").optional().isISO8601(),
    query("dateTo").optional().isISO8601(),
  ],
  expenseController.listExpenses
);
router.get(
  "/summary",
  [query("dateFrom").optional().isISO8601(), query("dateTo").optional().isISO8601()],
  expenseController.getExpenseSummary
);
router.get("/:id", [param("id").isInt({ min: 1 })], expenseController.getExpense);
router.patch("/:id", [param("id").isInt({ min: 1 }), ...expenseValidation], expenseController.updateExpense);
router.delete("/:id", [param("id").isInt({ min: 1 })], expenseController.deleteExpense);

module.exports = router;
