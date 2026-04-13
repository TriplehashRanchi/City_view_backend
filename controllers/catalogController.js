const catalogModel = require("../models/catalogModel");
const { handleValidationErrors, parsePagination, toNullableString } = require("../utils/validation");

const safeError = (res, error) => {
  console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Server error",
  });
};

exports.listProducts = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
   const result = await catalogModel.listProducts({
  search: toNullableString(req.query.search),
  status: toNullableString(req.query.status),
  categoryId: req.query.categoryId ? Number(req.query.categoryId) : null,
  foodType: toNullableString(req.query.foodType),
  sortBy: toNullableString(req.query.sortBy),
  sortOrder: toNullableString(req.query.sortOrder),
  limit,
  offset,
});

    return res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.listCategories = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await catalogModel.listCategories({
      search: toNullableString(req.query.search),
      status: toNullableString(req.query.status),
      sortBy: toNullableString(req.query.sortBy),
      sortOrder: toNullableString(req.query.sortOrder),
      limit,
      offset,
    });

    return res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.createCategory = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const categoryId = await catalogModel.createCategory({
      name: req.body.name.trim(),
      slug: req.body.slug.trim().toLowerCase(),
      status: req.body.status || "active",
      sortOrder: Number(req.body.sortOrder || 1),
    });

    const category = await catalogModel.getCategoryById(categoryId);
    return res.status(201).json({ success: true, message: "Category created", data: category });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updateCategory = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const existing = await catalogModel.getCategoryById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Category not found" });

    await catalogModel.updateCategory(req.params.id, {
      name: req.body.name.trim(),
      slug: req.body.slug.trim().toLowerCase(),
      status: req.body.status || existing.status,
      sortOrder: Number(req.body.sortOrder ?? existing.sort_order),
    });

    const category = await catalogModel.getCategoryById(req.params.id);
    return res.json({ success: true, message: "Category updated", data: category });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await catalogModel.getProductById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, data: product });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.createProduct = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const foodType = toNullableString(req.body.foodType)?.toLowerCase();

    if (!foodType) {
      return res.status(400).json({ success: false, message: "Food type is required" });
    }

    const category = await catalogModel.getCategoryById(Number(req.body.categoryId));
    if (!category) {
      return res.status(400).json({ success: false, message: "Category not found" });
    }

    const productId = await catalogModel.createProduct({
      name: req.body.name.trim(),
      imageUrl: toNullableString(req.body.imageUrl),
      categoryId: Number(req.body.categoryId),
      foodType,
      basePrice: Number(req.body.basePrice),
      description: toNullableString(req.body.description),
      status: req.body.status || "active",
      adminId: req.admin.id,
    });

    const product = await catalogModel.getProductById(productId);
    return res.status(201).json({ success: true, message: "Product created", data: product });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updateProduct = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const foodType = toNullableString(req.body.foodType)?.toLowerCase();

    if (!foodType) {
      return res.status(400).json({ success: false, message: "Food type is required" });
    }

    const existing = await catalogModel.getProductById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Product not found" });

    const category = await catalogModel.getCategoryById(Number(req.body.categoryId));
    if (!category) {
      return res.status(400).json({ success: false, message: "Category not found" });
    }

    await catalogModel.updateProduct(req.params.id, {
      name: req.body.name.trim(),
      imageUrl: toNullableString(req.body.imageUrl),
      categoryId: Number(req.body.categoryId),
      foodType,
      basePrice: Number(req.body.basePrice),
      description: toNullableString(req.body.description),
      status: req.body.status || existing.status,
    });

    const product = await catalogModel.getProductById(req.params.id);
    return res.json({ success: true, message: "Product updated", data: product });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.listPackages = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await catalogModel.listPackages({
      search: toNullableString(req.query.search),
      status: toNullableString(req.query.status),
      sortBy: toNullableString(req.query.sortBy),
      sortOrder: toNullableString(req.query.sortOrder),
      limit,
      offset,
    });
    return res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getPackage = async (req, res) => {
  try {
    const pkg = await catalogModel.getPackageById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    return res.json({ success: true, data: pkg });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.createPackage = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const packageId = await catalogModel.createPackage({
      name: req.body.name.trim(),
      description: toNullableString(req.body.description),
      perPersonPrice: Number(req.body.perPersonPrice),
      status: req.body.status || "active",
      adminId: req.admin.id,
      products: req.body.products || [],
    });

    const pkg = await catalogModel.getPackageById(packageId);
    return res.status(201).json({ success: true, message: "Package created", data: pkg });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updatePackage = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const existing = await catalogModel.getPackageById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Package not found" });

    await catalogModel.updatePackage(req.params.id, {
      name: req.body.name.trim(),
      description: toNullableString(req.body.description),
      perPersonPrice: Number(req.body.perPersonPrice),
      status: req.body.status || existing.status,
      products: req.body.products || [],
    });

    const pkg = await catalogModel.getPackageById(req.params.id);
    return res.json({ success: true, message: "Package updated", data: pkg });
  } catch (error) {
    return safeError(res, error);
  }
};
