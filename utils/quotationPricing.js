const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const assertPositiveNumber = (value, fieldName) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const error = new Error(`${fieldName} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }
  return numeric;
};

exports.resolveLineTotal = ({ pricingType, unitPrice, quantity = 1, guestCount = 0 }) => {
  const safeUnitPrice = assertPositiveNumber(unitPrice, "Unit price");
  const safeQuantity = assertPositiveNumber(quantity, "Quantity");
  const safeGuestCount = assertPositiveNumber(guestCount, "Guest count");

  let total = 0;
  if (pricingType === "per_person") {
    total = safeUnitPrice * safeGuestCount * Math.max(safeQuantity, 1);
  } else if (pricingType === "per_unit") {
    total = safeUnitPrice * safeQuantity;
  } else if (pricingType === "fixed") {
    total = safeUnitPrice * Math.max(safeQuantity, 1);
  } else {
    const error = new Error("Invalid pricing type");
    error.statusCode = 400;
    throw error;
  }

  return roundMoney(total);
};

exports.computeDiscountAmount = ({ subtotalAmount, discountType, discountValue }) => {
  const subtotal = assertPositiveNumber(subtotalAmount, "Subtotal");
  const value = assertPositiveNumber(discountValue || 0, "Discount value");

  if (discountType === "none" || !value) return 0;
  if (discountType === "flat") return roundMoney(Math.min(value, subtotal));
  if (discountType === "percentage") return roundMoney(Math.min((subtotal * value) / 100, subtotal));

  const error = new Error("Invalid discount type");
  error.statusCode = 400;
  throw error;
};

exports.computeQuoteTotals = ({ lineItems, discountType = "none", discountValue = 0, manualAdjustment = 0 }) => {
  const subtotalAmount = roundMoney(
    lineItems.reduce((sum, item) => sum + assertPositiveNumber(item.line_total, "Line total"), 0)
  );
  const discountAmount = exports.computeDiscountAmount({ subtotalAmount, discountType, discountValue });
  const safeManualAdjustment = Number(manualAdjustment || 0);
  if (!Number.isFinite(safeManualAdjustment)) {
    const error = new Error("Manual adjustment must be numeric");
    error.statusCode = 400;
    throw error;
  }

  const finalAmount = roundMoney(subtotalAmount - discountAmount + safeManualAdjustment);
  if (finalAmount < 0) {
    const error = new Error("Final quotation amount cannot be negative");
    error.statusCode = 400;
    throw error;
  }

  return {
    subtotalAmount,
    discountAmount,
    finalAmount,
    manualAdjustment: roundMoney(safeManualAdjustment),
  };
};
