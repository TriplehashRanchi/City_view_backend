const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const clientRoutes = require("./routes/clientRoutes");
const catalogRoutes = require("./routes/catalogRoutes");
const eventRoutes = require("./routes/eventRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const searchRoutes = require("./routes/searchRoutes");

const app = express();

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server requests and Postman
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => res.send("API Running"));

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/operations", eventRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/search", searchRoutes);

app.use((err, req, res, next) => {
  if (err?.message === "CORS blocked") {
    return res.status(403).json({ success: false, message: "Origin not allowed by CORS policy" });
  }
  return next(err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
