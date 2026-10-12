const express = require("express");
const {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
} = require("../controllers/patientController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validatePatient } = require("../validators/patientValidator");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(authorize("admin", "receptionist", "doctor"), getPatients)
  .post(authorize("admin", "receptionist"), validatePatient, createPatient);
router
  .route("/:id")
  .get(authorize("admin", "receptionist", "doctor"), getPatientById)
  .put(authorize("admin", "receptionist"), validatePatient, updatePatient)
  .delete(authorize("admin"), deletePatient);

module.exports = router;
