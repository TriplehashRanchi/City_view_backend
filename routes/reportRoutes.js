const express = require("express");
const quotationController = require("../controllers/quotationController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/dashboard", quotationController.getDashboardReport);

module.exports = router;
