const express = require("express");
const controller = require("../controllers/prescriptionController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validatePrescriptionId,
  validateConsultationId,
  validatePrescriptionDraft,
  validatePrescriptionIssue,
  validatePrescriptionListQuery,
} = require("../validators/prescriptionValidator");

const router = express.Router();
router.use(protect, authorize("doctor"));

router.get("/", validatePrescriptionListQuery, controller.listPrescriptions);
router.get(
  "/consultation/:consultationId",
  validateConsultationId,
  controller.getPrescriptionForConsultation
);
router.post(
  "/consultation/:consultationId",
  validateConsultationId,
  controller.createPrescription
);
router.get("/:id", validatePrescriptionId, controller.getPrescription);
router.patch(
  "/:id",
  validatePrescriptionId,
  validatePrescriptionDraft,
  controller.saveDraft
);
router.post(
  "/:id/issue",
  validatePrescriptionId,
  validatePrescriptionIssue,
  controller.issuePrescription
);

module.exports = router;
