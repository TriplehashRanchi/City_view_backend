const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const assertNonNegativeNumber = (value, fieldName) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const error = new Error(`${fieldName} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }
  return numeric;
};

exports.roundMoney = roundMoney;

exports.computeDiscountAmount = ({ subtotalAmount, discountType, discountValue }) => {
  const subtotal = assertNonNegativeNumber(subtotalAmount, "Subtotal");
  const value = assertNonNegativeNumber(discountValue || 0, "Discount value");

  if (discountType === "none" || value === 0) return 0;
  if (discountType === "flat") return roundMoney(Math.min(value, subtotal));
  if (discountType === "percentage") return roundMoney(Math.min((subtotal * value) / 100, subtotal));

  const error = new Error("Invalid discount type");
  error.statusCode = 400;
  throw error;
};

exports.computeQuoteTotals = ({ perPersonPrice, guestCount, discountType = "none", discountValue = 0 }) => {
  const safePerPersonPrice = assertNonNegativeNumber(perPersonPrice, "Per person price");
  const safeGuestCount = assertNonNegativeNumber(guestCount, "Guest count");

  const subtotalAmount = roundMoney(safePerPersonPrice * safeGuestCount);
  const discountAmount = exports.computeDiscountAmount({ subtotalAmount, discountType, discountValue });
  const finalAmount = roundMoney(subtotalAmount - discountAmount);

  if (finalAmount < 0) {
    const error = new Error("Final quotation amount cannot be negative");
    error.statusCode = 400;
    throw error;
  }

  return {
    subtotalAmount,
    discountAmount,
    finalAmount,
  };
};
