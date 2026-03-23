const quotationModel = require("../models/quotationModel");
const { handleValidationErrors, toNullableString } = require("../utils/validation");

const safeError = (res, error) => {
  console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Server error",
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
      internalNotes: toNullableString(req.body.internalNotes),
      customerNotes: toNullableString(req.body.customerNotes),
      selectedPackages: req.body.selectedPackages || [],
      customItems: req.body.customItems || [],
      discountType: req.body.discountType || "none",
      discountValue: Number(req.body.discountValue || 0),
      manualAdjustment: Number(req.body.manualAdjustment || 0),
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
      notes: toNullableString(req.body.notes),
      adminId: req.admin.id,
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
        finalAmount: version.final_amount,
        customerNotes: version.customer_notes,
        termsAndConditions: version.terms_and_conditions,
        restaurantBranding: {
          name: process.env.RESTAURANT_NAME || "CityView Restaurant",
          tagline: process.env.RESTAURANT_TAGLINE || "Event Dining & Hospitality",
        },
        event: {
          occasionType: version.occasion_type,
          eventDate: version.event_date,
          startTime: version.start_time,
          endTime: version.end_time,
          guestCount: version.guest_count,
          venue: version.venue,
        },
        client: {
          name: version.client_name,
          email: version.client_email,
          phone: version.client_phone,
        },
      },
    });
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
