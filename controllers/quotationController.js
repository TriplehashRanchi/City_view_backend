const quotationModel = require("../models/quotationModel");
const { buildQuotationPdf } = require("../utils/quotationPdf");
const { handleValidationErrors, toNullableString } = require("../utils/validation");

const safeError = (res, error) => {
  console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Server error",
  });
};

const getBranding = () => ({
  name: process.env.RESTAURANT_NAME || "CityView Restaurant",
  tagline: process.env.RESTAURANT_TAGLINE || "Event Dining & Hospitality",
  address: process.env.RESTAURANT_ADDRESS || "",
  email: process.env.RESTAURANT_EMAIL || "",
  phone: process.env.RESTAURANT_PHONE || "",
  website: process.env.RESTAURANT_WEBSITE || "",
});

const sendQuotationDownload = (res, version) => {
  return buildQuotationPdf({
    version,
    branding: getBranding(),
  }).then(({ buffer, fileName }) => {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  });
};

exports.createQuotation = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const quotationId = await quotationModel.createQuotation({
      eventId: Number(req.body.eventId),
      adminId: req.admin.id,
    });

    const quotation = await quotationModel.getQuotationById(quotationId);
    return res.status(201).json({ success: true, message: "Quotation initialized", data: quotation });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getQuotation = async (req, res) => {
  try {
    const quotation = await quotationModel.getQuotationById(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });
    return res.json({ success: true, data: quotation });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.listQuotationsByEvent = async (req, res) => {
  try {
    const rows = await quotationModel.listQuotationsByEvent(req.params.eventId);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.createQuotationVersion = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const versionId = await quotationModel.createQuotationVersion({
      quotationId: Number(req.params.quotationId),
      validUntil: toNullableString(req.body.validUntil),
      termsAndConditions: toNullableString(req.body.termsAndConditions),
      notes: toNullableString(req.body.notes),
      sourcePackageId: req.body.sourcePackageId ? Number(req.body.sourcePackageId) : null,
      productIds: req.body.productIds || [],
      excludedProductIds: req.body.excludedProductIds || [],
      customItems: req.body.customItems || [],
      perPersonPrice: Number(req.body.perPersonPrice),
      guestCount: Number(req.body.guestCount || 0),
      discountType: req.body.discountType || "none",
      discountValue: Number(req.body.discountValue || 0),
      adminId: req.admin.id,
    });

    const version = await quotationModel.getQuotationVersionById(versionId);
    return res.status(201).json({ success: true, message: "Quotation version created", data: version });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.cloneQuotationVersion = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const versionId = await quotationModel.cloneQuotationVersion({
      versionId: Number(req.params.versionId),
      adminId: req.admin.id,
    });
    const version = await quotationModel.getQuotationVersionById(versionId);
    return res.status(201).json({ success: true, message: "Quotation version cloned", data: version });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getQuotationVersion = async (req, res) => {
  try {
    const version = await quotationModel.getQuotationVersionById(req.params.versionId);
    if (!version) return res.status(404).json({ success: false, message: "Quotation version not found" });
    return res.json({ success: true, data: version });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updateQuotationVersionStatus = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    await quotationModel.updateQuotationVersionStatus({
      versionId: Number(req.params.versionId),
      status: req.body.status,
    });
    const version = await quotationModel.getQuotationVersionById(req.params.versionId);
    return res.json({ success: true, message: "Quotation status updated", data: version });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getPdfPayload = async (req, res) => {
  try {
    const version = await quotationModel.getQuotationVersionById(req.params.versionId);
    if (!version) return res.status(404).json({ success: false, message: "Quotation version not found" });

    return res.json({
      success: true,
      data: {
        quoteCode: version.quote_code,
        versionNumber: version.version_number,
        status: version.status,
        validUntil: version.valid_until,
        perPersonPrice: version.per_person_price,
        guestCount: version.guest_count,
        subtotalAmount: version.subtotal_amount,
        discountAmount: version.discount_amount,
        finalAmount: version.final_amount,
        notes: version.notes,
        termsAndConditions: version.terms_and_conditions,
        displayAsPackage: Boolean(version.display_as_package),
        sourcePackage: version.source_package,
        restaurantBranding: getBranding(),
        event: version.event_snapshot,
        client: version.client_snapshot,
        items: version.items,
      },
    });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.downloadQuotation = async (req, res) => {
  try {
    const quotation = await quotationModel.getQuotationById(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

    let targetVersionId = quotation.latest_version_id;
    if (req.query.versionId !== undefined) {
      targetVersionId = Number(req.query.versionId);
      if (!Number.isInteger(targetVersionId) || targetVersionId < 1) {
        return res.status(400).json({ success: false, message: "Invalid versionId" });
      }
    }

    if (!targetVersionId) {
      return res.status(400).json({ success: false, message: "No quotation version available for download" });
    }

    const version = await quotationModel.getQuotationVersionById(targetVersionId);
    if (!version) {
      return res.status(404).json({ success: false, message: "Quotation version not found" });
    }
    if (Number(version.quotation_id) !== Number(quotation.id)) {
      return res.status(400).json({ success: false, message: "Requested version does not belong to this quotation" });
    }

    return await sendQuotationDownload(res, version);
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getDashboardReport = async (req, res) => {
  try {
    const report = await quotationModel.getDashboardReport();
    return res.json({ success: true, data: report });
  } catch (error) {
    return safeError(res, error);
  }
};
