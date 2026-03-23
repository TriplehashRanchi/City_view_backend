const express = require("express");
const router = express.Router();

const eventController = require("../controllers/eventController");
const { requireAuth } = require("../middlewares/authMiddleware");

router.use(requireAuth);

router.post("/create", eventController.createClient);
router.post("/", eventController.createClient);
router.get("/", eventController.getClients);
router.get("/:id", eventController.getClient);
router.patch("/:id", eventController.updateClient);

module.exports = router;
