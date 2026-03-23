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
      category: toNullableString(req.query.category),
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
    const productId = await catalogModel.createProduct({
      name: req.body.name.trim(),
      category: req.body.category.trim(),
      unitPrice: Number(req.body.unitPrice),
      pricingType: req.body.pricingType,
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
    const existing = await catalogModel.getProductById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Product not found" });

    await catalogModel.updateProduct(req.params.id, {
      name: req.body.name.trim(),
      category: req.body.category.trim(),
      unitPrice: Number(req.body.unitPrice),
      pricingType: req.body.pricingType,
      description: toNullableString(req.body.description),
      status: req.body.status || existing.status,
    });

    const product = await catalogModel.getProductById(req.params.id);
    return res.json({ success: true, message: "Product updated", data: product });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.listServices = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await catalogModel.listServices({
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

exports.getService = async (req, res) => {
  try {
    const service = await catalogModel.getServiceById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Service not found" });
    return res.json({ success: true, data: service });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.createService = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const serviceId = await catalogModel.createService({
      name: req.body.name.trim(),
      pricingType: req.body.pricingType,
      costValue: Number(req.body.costValue),
      description: toNullableString(req.body.description),
      status: req.body.status || "active",
      adminId: req.admin.id,
    });

    const service = await catalogModel.getServiceById(serviceId);
    return res.status(201).json({ success: true, message: "Service created", data: service });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updateService = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const existing = await catalogModel.getServiceById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Service not found" });

    await catalogModel.updateService(req.params.id, {
      name: req.body.name.trim(),
      pricingType: req.body.pricingType,
      costValue: Number(req.body.costValue),
      description: toNullableString(req.body.description),
      status: req.body.status || existing.status,
    });

    const service = await catalogModel.getServiceById(req.params.id);
    return res.json({ success: true, message: "Service updated", data: service });
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
      pricingType: req.body.pricingType,
      basePrice: Number(req.body.basePrice),
      minimumGuestCount: Number(req.body.minimumGuestCount || 1),
      status: req.body.status || "active",
      adminId: req.admin.id,
      products: req.body.products || [],
      services: req.body.services || [],
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
      pricingType: req.body.pricingType,
      basePrice: Number(req.body.basePrice),
      minimumGuestCount: Number(req.body.minimumGuestCount || 1),
      status: req.body.status || existing.status,
      products: req.body.products || [],
      services: req.body.services || [],
    });

    const pkg = await catalogModel.getPackageById(req.params.id);
    return res.json({ success: true, message: "Package updated", data: pkg });
  } catch (error) {
    return safeError(res, error);
  }
};
