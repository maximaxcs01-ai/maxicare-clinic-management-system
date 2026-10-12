const express = require("express");
const controller = require("../controllers/patientController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validatePatient, validateOwnPatient } = require("../validators/patientValidator");

const router = express.Router();
router.use(protect);
router.get("/me", authorize("patient"), controller.getOwnPatient);
router.put("/me", authorize("patient"), validateOwnPatient, controller.updateOwnPatient);
router.get("/", authorize("admin", "receptionist", "doctor"), controller.getPatients);
router.post("/", authorize("admin", "receptionist"), validatePatient, controller.createPatient);
router.get("/:id", authorize("admin", "receptionist", "doctor"), controller.getPatientById);
router.put("/:id", authorize("admin", "receptionist"), validatePatient, controller.updatePatient);
router.delete("/:id", authorize("admin"), controller.deletePatient);

module.exports = router;
