const express = require("express");
const controller = require("../controllers/appointmentController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validateAppointmentBooking,
  validateAppointmentListQuery,
  validateDoctorAppointmentQuery,
  validateStaffAppointmentQuery,
  validateAppointmentRejection,
  validateAppointmentCancellation,
  validateAppointmentReschedule,
  validateAppointmentDeletion,
} = require("../validators/appointmentValidator");
const { validateTriageVitals } = require("../validators/triageValidator");

const router = express.Router();

router.use(protect);

router.get(
  "/my",
  authorize("patient"),
  validateAppointmentListQuery,
  controller.listMyAppointments
);

router.get(
  "/doctor/my",
  authorize("doctor"),
  validateDoctorAppointmentQuery,
  controller.listDoctorAppointments
);

router.post(
  "/",
  authorize("patient"),
  validateAppointmentBooking,
  controller.createAppointment
);

router.get(
  "/",
  authorize("admin", "receptionist"),
  validateStaffAppointmentQuery,
  controller.listAllAppointments
);

router.delete(
  "/:id",
  authorize("admin"),
  validateAppointmentDeletion,
  controller.deleteAppointment
);

router.get(
  "/:id",
  authorize("patient", "admin", "receptionist"),
  controller.getAppointment
);

router.patch(
  "/:id/confirm",
  authorize("admin", "receptionist"),
  controller.confirmAppointment
);

router.patch(
  "/:id/reject",
  authorize("admin", "receptionist"),
  validateAppointmentRejection,
  controller.rejectAppointment
);

router.patch(
  "/:id/cancel",
  authorize("patient"),
  validateAppointmentCancellation,
  controller.cancelAppointment
);

router.patch(
  "/:id/check-in",
  authorize("admin", "receptionist"),
  controller.checkInAppointment
);

router.post(
  "/:id/queue",
  authorize("admin", "receptionist"),
  controller.addAppointmentToQueue
);

router.patch(
  "/:id/triage",
  authorize("admin", "receptionist"),
  validateTriageVitals,
  controller.recordTriageVitals
);

router.patch(
  "/:id/reschedule",
  authorize("patient", "admin", "receptionist"),
  validateAppointmentReschedule,
  controller.rescheduleAppointment
);

module.exports = router;
