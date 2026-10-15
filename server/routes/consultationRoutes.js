const express = require("express");
const controller = require("../controllers/consultationController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validateConsultationId,
  validateQueueEntryId,
  validateConsultationDraft,
  validateConsultationListQuery,
  validatePrescriptionDecision,
} = require("../validators/consultationValidator");

const router = express.Router();
router.use(protect, authorize("doctor"));

router.get("/", validateConsultationListQuery, controller.listConsultations);
router.post(
  "/queue/:queueEntryId/start",
  validateQueueEntryId,
  controller.startConsultation
);
router.get("/:id", validateConsultationId, controller.getConsultation);
router.patch(
  "/:id",
  validateConsultationId,
  validateConsultationDraft(),
  controller.saveDraft
);
router.patch(
  "/:id/prescription-decision",
  validateConsultationId,
  validatePrescriptionDecision,
  controller.markNoPrescriptionNeeded
);
router.post(
  "/:id/complete",
  validateConsultationId,
  validateConsultationDraft(true),
  controller.completeConsultation
);

module.exports = router;
