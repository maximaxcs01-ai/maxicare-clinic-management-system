const express = require("express");
const controller = require("../controllers/scheduleController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateSchedule } = require("../validators/scheduleValidator");

const router = express.Router({ mergeParams: true });
router.use(protect);
router.get("/:doctorId/schedule", authorize("admin", "receptionist", "doctor"), controller.getSchedule);
router.put("/:doctorId/schedule", authorize("admin", "doctor"), validateSchedule, controller.saveSchedule);

module.exports = router;
