const express = require("express");
const { body, param, query } = require("express-validator");
const eventController = require("../controllers/eventController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);

const clientValidation = [
  body("name").trim().isLength({ min: 2, max: 150 }),
  body("phone").optional({ nullable: true }).trim().isLength({ min: 8, max: 30 }),
  body("email").optional({ nullable: true }).trim().isEmail(),
  body("companyName").optional({ nullable: true }).isString(),
  body("notes").optional({ nullable: true }).isString(),
  body("status").optional().isIn(["active", "inactive"]),
];

const eventValidation = [
  body("clientId").optional().isInt({ min: 1 }),
  body("client").optional().isObject(),
  body("client.name").optional().trim().isLength({ min: 2, max: 150 }),
  body("client.phone").optional({ nullable: true }).trim().isLength({ min: 8, max: 30 }),
  body("client.email").optional({ nullable: true }).trim().isEmail(),
  body("client.companyName").optional({ nullable: true }).isString(),
  body("client.notes").optional({ nullable: true }).isString(),
  body("occasionType").trim().isLength({ min: 2, max: 120 }),
  body("eventDate").isISO8601(),
  body("startTime").matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body("endTime").optional({ nullable: true }).matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body("guestCount").isInt({ min: 1, max: 100000 }),
  body("venue").trim().isLength({ min: 2, max: 180 }),
  body("notes").optional({ nullable: true }).isString(),
  body("eventStatus").optional().isIn(["enquiry", "quoted", "confirmed", "cancelled"]),
];

router.post("/clients/create", clientValidation, eventController.createClient);
router.post("/clients", clientValidation, eventController.createClient);
router.get("/clients", [query("status").optional().isIn(["active", "inactive"])], eventController.getClients);
router.get("/clients/:id", [param("id").isInt({ min: 1 })], eventController.getClient);
router.patch("/clients/:id", [param("id").isInt({ min: 1 }), ...clientValidation], eventController.updateClient);

router.post("/events", eventValidation, eventController.createEvent);
router.get("/events", [query("status").optional().isIn(["enquiry", "quoted", "confirmed", "cancelled"])], eventController.listEvents);
router.get("/events/:id", [param("id").isInt({ min: 1 })], eventController.getEvent);
router.patch("/events/:id", [param("id").isInt({ min: 1 }), ...eventValidation], eventController.updateEvent);

module.exports = router;
