const express = require("express");
const controller = require("../controllers/appointmentController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validateAppointmentBooking,
  validateAppointmentListQuery,
} = require("../validators/appointmentValidator");

const router = express.Router();
router.use(protect, authorize("patient"));
router.get("/my", validateAppointmentListQuery, controller.listMyAppointments);
router.post("/", validateAppointmentBooking, controller.createAppointment);
router.get("/:id", controller.getMyAppointment);

module.exports = router;
