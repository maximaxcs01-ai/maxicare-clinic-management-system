const express = require("express");
const controller = require("../controllers/patientRecordsController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/me", authorize("patient"), controller.getPatientHistory);
router.get(
  "/me/consultations/:consultationId",
  authorize("patient"),
  controller.getOwnCompletedConsultation
);
router.get("/patients", authorize("doctor"), controller.listDoctorPatients);
router.get(
  "/patients/:patientId",
  authorize("doctor"),
  controller.getDoctorPatientRecord
);

module.exports = router;
