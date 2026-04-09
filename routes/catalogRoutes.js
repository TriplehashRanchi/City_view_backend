const express = require("express");
const { body, param, query } = require("express-validator");
const catalogController = require("../controllers/catalogController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);

const productCategories = ["starter", "main_course", "dessert", "drink", "tandoor", "salad"];

const pricingTypeValidation = body("pricingType")
  .isIn(["per_person", "per_unit", "fixed"])
  .withMessage("pricingType must be per_person, per_unit, or fixed");

const statusValidation = body("status")
  .optional()
  .isIn(["active", "inactive"])
  .withMessage("status must be active or inactive");

const foodTypeValidation = body("foodType")
  .trim()
  .isIn(["veg", "non_veg"])
  .withMessage("foodType must be veg or non_veg");

const productCategoryValidation = body("category")
  .trim()
  .isIn(productCategories)
  .withMessage(`category must be one of: ${productCategories.join(", ")}`);

router.get(
  "/products",
  [query("status").optional().isIn(["active", "inactive"]), query("limit").optional().isInt({ min: 1, max: 100 })],
  catalogController.listProducts
);
router.get("/products/:id", [param("id").isInt({ min: 1 })], catalogController.getProduct);
router.post(
  "/products",
  [
    body("name").trim().isLength({ min: 2, max: 180 }),
    productCategoryValidation,
    foodTypeValidation,
    body("unitPrice").isFloat({ min: 0 }),
    pricingTypeValidation,
    body("description").optional({ nullable: true }).isString(),
    statusValidation,
  ],
  catalogController.createProduct
);
router.patch(
  "/products/:id",
  [
    param("id").isInt({ min: 1 }),
    body("name").trim().isLength({ min: 2, max: 180 }),
    productCategoryValidation,
    foodTypeValidation,
    body("unitPrice").isFloat({ min: 0 }),
    pricingTypeValidation,
    body("description").optional({ nullable: true }).isString(),
    statusValidation,
  ],
  catalogController.updateProduct
);

router.get("/services", [query("status").optional().isIn(["active", "inactive"])], catalogController.listServices);
router.get("/services/:id", [param("id").isInt({ min: 1 })], catalogController.getService);
router.post(
  "/services",
  [
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("costValue").isFloat({ min: 0 }),
    pricingTypeValidation,
    body("description").optional({ nullable: true }).isString(),
    statusValidation,
  ],
  catalogController.createService
);
router.patch(
  "/services/:id",
  [
    param("id").isInt({ min: 1 }),
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("costValue").isFloat({ min: 0 }),
    pricingTypeValidation,
    body("description").optional({ nullable: true }).isString(),
    statusValidation,
  ],
  catalogController.updateService
);

router.get("/packages", [query("status").optional().isIn(["active", "inactive"])], catalogController.listPackages);
router.get("/packages/:id", [param("id").isInt({ min: 1 })], catalogController.getPackage);
router.post(
  "/packages",
  [
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("description").optional({ nullable: true }).isString(),
    body("minimumGuestCount").optional().isInt({ min: 1 }),
    statusValidation,
    body("products").optional().isArray(),
    body("products.*.productId").optional().isInt({ min: 1 }),
    body("products.*.quantity").optional().isFloat({ min: 0.01 }),
    body("products.*.notes").optional({ nullable: true }).isString(),
    body("services").optional().isArray(),
    body("services.*.serviceId").optional().isInt({ min: 1 }),
    body("services.*.quantity").optional().isFloat({ min: 0.01 }),
    body("services.*.notes").optional({ nullable: true }).isString(),
  ],
  catalogController.createPackage
);
router.patch(
  "/packages/:id",
  [
    param("id").isInt({ min: 1 }),
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("description").optional({ nullable: true }).isString(),
    body("minimumGuestCount").optional().isInt({ min: 1 }),
    statusValidation,
    body("products").optional().isArray(),
    body("products.*.productId").optional().isInt({ min: 1 }),
    body("products.*.quantity").optional().isFloat({ min: 0.01 }),
    body("products.*.notes").optional({ nullable: true }).isString(),
    body("services").optional().isArray(),
    body("services.*.serviceId").optional().isInt({ min: 1 }),
    body("services.*.quantity").optional().isFloat({ min: 0.01 }),
    body("services.*.notes").optional({ nullable: true }).isString(),
  ],
  catalogController.updatePackage
);

module.exports = router;
