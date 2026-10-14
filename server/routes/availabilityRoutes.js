const express = require("express");
const { getAvailability } = require("../controllers/availabilityController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/", protect, authorize("admin", "receptionist", "doctor", "patient"), getAvailability);

module.exports = router;
