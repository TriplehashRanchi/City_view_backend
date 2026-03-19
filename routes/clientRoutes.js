const express = require("express");
const router = express.Router();

const clientController = require("../controllers/clientController");
const { requireAuth } = require("../middlewares/authMiddleware");

router.use(requireAuth);

router.post("/create", clientController.createClient);
router.get("/", clientController.getClients);

module.exports = router;
