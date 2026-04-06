const express = require("express");
const searchController = require("../controllers/searchController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", searchController.globalSearch);

module.exports = router;
