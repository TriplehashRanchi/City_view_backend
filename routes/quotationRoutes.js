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
    body("notes").optional({ nullable: true }).isString(),
    body("sourcePackageId").optional({ nullable: true }).isInt({ min: 1 }),
    body("productIds").optional().isArray(),
    body("productIds.*").optional().isInt({ min: 1 }),
    body("excludedProductIds").optional().isArray(),
    body("excludedProductIds.*").optional().isInt({ min: 1 }),
    body("perPersonPrice").isFloat({ min: 0 }),
    body("guestCount").optional().isInt({ min: 1 }),
    body("discountType").optional().isIn(["none", "flat", "percentage"]),
    body("discountValue").optional().isFloat({ min: 0 }),
    body("customItems").optional().isArray(),
    body("customItems.*.name").optional().trim().isLength({ min: 1, max: 190 }),
    body("customItems.*.description").optional({ nullable: true }).isString(),
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
    body("status").isIn(["draft", "sent", "accepted", "rejected"]),
  ],
  quotationController.updateQuotationVersionStatus
);

module.exports = router;
