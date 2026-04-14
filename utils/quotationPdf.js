const path = require("path");
const ejs = require("ejs");
const puppeteer = require("puppeteer");

const TEMPLATE_PATH = path.join(__dirname, "..", "views", "quotation-pdf.ejs");

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatStatus = (value) => {
  const text = String(value || "-");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const sanitizeFileName = (value) => String(value || "quotation").replace(/[^a-zA-Z0-9-_]/g, "_");

const buildTemplateData = ({ version, branding }) => {
  const client = version.client_snapshot || {};
  const event = version.event_snapshot || {};

  return {
    branding,
    version,
    client,
    event,
    issueDate: formatDate(version.created_at || new Date()),
    validUntil: formatDate(version.valid_until),
    statusLabel: formatStatus(version.status),
    perPersonPrice: formatCurrency(version.per_person_price),
    subtotalAmount: formatCurrency(version.subtotal_amount),
    discountAmount: formatCurrency(version.discount_amount),
    finalAmount: formatCurrency(version.final_amount),
    guestCountLabel: `${version.guest_count || 0} pax`,
    items: version.items || [],
    greetingName: client.name || "Customer",
    introOccasion: String(event.occasionType || "event").toLowerCase(),
    formatCurrency,
    formatDate,
    formatStatus,
  };
};

exports.buildQuotationPdf = async ({ version, branding }) => {
  const html = await ejs.renderFile(TEMPLATE_PATH, buildTemplateData({ version, branding }), {
    async: true,
  });

  const browser = await puppeteer.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
    });

    return {
      buffer,
      fileName: `${sanitizeFileName(version.quote_code)}-v${version.version_number}.pdf`,
    };
  } finally {
    await browser.close();
  }
};
