const express = require("express");
const { body, param, query } = require("express-validator");
const catalogController = require("../controllers/catalogController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);

const statusValidation = body("status")
  .optional()
  .isIn(["active", "inactive"])
  .withMessage("status must be active or inactive");

const foodTypeValidation = body("foodType")
  .trim()
  .isIn(["veg", "non_veg"])
  .withMessage("foodType must be veg or non_veg");

router.get("/categories", [query("status").optional().isIn(["active", "inactive"])], catalogController.listCategories);
router.post(
  "/categories",
  [
    body("name").trim().isLength({ min: 2, max: 100 }),
    body("slug").trim().matches(/^[a-z0-9_]+$/),
    body("sortOrder").optional().isInt({ min: 1 }),
    statusValidation,
  ],
  catalogController.createCategory
);
router.patch(
  "/categories/:id",
  [
    param("id").isInt({ min: 1 }),
    body("name").trim().isLength({ min: 2, max: 100 }),
    body("slug").trim().matches(/^[a-z0-9_]+$/),
    body("sortOrder").optional().isInt({ min: 1 }),
    statusValidation,
  ],
  catalogController.updateCategory
);

router.get(
  "/products",
  [
    query("status").optional().isIn(["active", "inactive"]),
    query("limit").optional().isInt({ min: 1, max: 1000 }),
    query("categoryId").optional().isInt({ min: 1 }),
    query("foodType").optional().isIn(["veg", "non_veg"]),
    query("search").optional().isString(),
  ],
  catalogController.listProducts
);
router.get("/products/:id", [param("id").isInt({ min: 1 })], catalogController.getProduct);
router.post(
  "/products",
  [
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("imageUrl").optional({ nullable: true }).isString(),
    body("categoryId").isInt({ min: 1 }),
    foodTypeValidation,
    body("basePrice").isFloat({ min: 0 }),
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
    body("imageUrl").optional({ nullable: true }).isString(),
    body("categoryId").isInt({ min: 1 }),
    foodTypeValidation,
    body("basePrice").isFloat({ min: 0 }),
    body("description").optional({ nullable: true }).isString(),
    statusValidation,
  ],
  catalogController.updateProduct
);

router.get("/packages", [query("status").optional().isIn(["active", "inactive"])], catalogController.listPackages);
router.get("/packages/:id", [param("id").isInt({ min: 1 })], catalogController.getPackage);
router.post(
  "/packages",
  [
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("description").optional({ nullable: true }).isString(),
    body("perPersonPrice").isFloat({ min: 0 }),
    statusValidation,
    body("products").optional().isArray(),
    body("products.*.productId").optional().isInt({ min: 1 }),
    body("products.*.sortOrder").optional().isInt({ min: 1 }),
  ],
  catalogController.createPackage
);
router.patch(
  "/packages/:id",
  [
    param("id").isInt({ min: 1 }),
    body("name").trim().isLength({ min: 2, max: 180 }),
    body("description").optional({ nullable: true }).isString(),
    body("perPersonPrice").isFloat({ min: 0 }),
    statusValidation,
    body("products").optional().isArray(),
    body("products.*.productId").optional().isInt({ min: 1 }),
    body("products.*.sortOrder").optional().isInt({ min: 1 }),
  ],
  catalogController.updatePackage
);

module.exports = router;
