const searchModel = require("../models/searchModel");

const safeError = (res, error) => {
  console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Server error",
  });
};

exports.globalSearch = async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    const limit = Number(req.query.limit || 5);

    if (!query) {
      return res.json({
        success: true,
        data: {
          query: "",
          results: [],
          groups: {},
          total: 0,
        },
      });
    }

    const grouped = await searchModel.globalSearch({ query, limit });

    const results = [
      ...grouped.clients.map((item) => ({
        id: `client-${item.id}`,
        entityId: item.id,
        type: "client",
        title: item.name,
        subtitle: [item.company_name, item.email || item.phone].filter(Boolean).join(" · "),
        status: item.status,
      })),
      ...grouped.events.map((item) => ({
        id: `event-${item.id}`,
        entityId: item.id,
        type: "event",
        title: `${item.client_name} · ${item.occasion_type}`,
        subtitle: [item.event_date, item.venue].filter(Boolean).join(" · "),
        status: item.event_status,
      })),
      ...grouped.products.map((item) => ({
        id: `product-${item.id}`,
        entityId: item.id,
        type: "product",
        title: item.name,
        subtitle: [item.category_name, item.food_type, `Rs ${item.base_price}`].filter(Boolean).join(" · "),
        status: item.status,
      })),
      ...grouped.packages.map((item) => ({
        id: `package-${item.id}`,
        entityId: item.id,
        type: "package",
        title: item.name,
        subtitle: item.per_person_price != null ? `Rs ${item.per_person_price} per person` : "",
        status: item.status,
      })),
      ...grouped.quotations.map((item) => ({
        id: `quotation-${item.id}`,
        entityId: item.id,
        type: "quotation",
        title: item.quote_code,
        subtitle: [item.client_name, item.occasion_type, item.event_date].filter(Boolean).join(" · "),
        status: item.current_status,
        eventId: item.event_id,
      })),
    ];

    return res.json({
      success: true,
      data: {
        query,
        results,
        groups: grouped,
        total: results.length,
      },
    });
  } catch (error) {
    return safeError(res, error);
  }
};
