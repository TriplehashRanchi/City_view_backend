const express = require("express");
const { body, param } = require("express-validator");
const quotationController = require("../controllers/quotationController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);

router.post("/init", [body("eventId").isInt({ min: 1 })], quotationController.createQuotation);
router.get("/event/:eventId", [param("eventId").isInt({ min: 1 })], quotationController.listQuotationsByEvent);
router.get("/:id", [param("id").isInt({ min: 1 })], quotationController.getQuotation);

router.post(
  "/:quotationId/versions",
  [
    param("quotationId").isInt({ min: 1 }),
    body("validUntil").optional({ nullable: true }).isISO8601(),
    body("termsAndConditions").optional({ nullable: true }).isString(),
    body("internalNotes").optional({ nullable: true }).isString(),
    body("customerNotes").optional({ nullable: true }).isString(),
    body("discountType").optional().isIn(["none", "flat", "percentage"]),
    body("discountValue").optional().isFloat({ min: 0 }),
    body("manualAdjustment").optional().isFloat(),
    body("selectedPackages").optional().isArray(),
    body("selectedPackages.*.packageId").optional().isInt({ min: 1 }),
    body("selectedPackages.*.quantity").optional().isFloat({ min: 0.01 }),
    body("selectedPackages.*.guestCount").optional().isInt({ min: 1 }),
    body("selectedPackages.*.unitPriceOverride").optional().isFloat({ min: 0 }),
    body("customItems").optional().isArray(),
    body("customItems.*.catalogType").optional().isIn(["product", "service", "custom"]),
    body("customItems.*.catalogId").optional().isInt({ min: 1 }),
    body("customItems.*.name").optional().isString(),
    body("customItems.*.description").optional().isString(),
    body("customItems.*.descriptionOverride").optional().isString(),
    body("customItems.*.pricingType").optional().isIn(["per_person", "per_unit", "fixed"]),
    body("customItems.*.unitPrice").optional().isFloat({ min: 0 }),
    body("customItems.*.unitPriceOverride").optional().isFloat({ min: 0 }),
    body("customItems.*.quantity").optional().isFloat({ min: 0.01 }),
    body("customItems.*.guestCount").optional().isInt({ min: 1 }),
    body("customItems.*.unitLabel").optional().isString(),
  ],
  quotationController.createQuotationVersion
);

router.post("/versions/:versionId/clone", [param("versionId").isInt({ min: 1 })], quotationController.cloneQuotationVersion);
router.get("/versions/:versionId", [param("versionId").isInt({ min: 1 })], quotationController.getQuotationVersion);
router.get("/versions/:versionId/pdf-data", [param("versionId").isInt({ min: 1 })], quotationController.getPdfPayload);
router.patch(
  "/versions/:versionId/status",
  [
    param("versionId").isInt({ min: 1 }),
    body("status").isIn(["draft", "sent", "accepted", "rejected", "expired"]),
    body("notes").optional({ nullable: true }).isString(),
  ],
  quotationController.updateQuotationVersionStatus
);

module.exports = router;
