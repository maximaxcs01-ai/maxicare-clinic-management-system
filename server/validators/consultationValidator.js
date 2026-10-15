const mongoose = require("mongoose");
const { normalizeVitals } = require("./vitalsValidator");

const TEXT_FIELDS = {
  chiefComplaint: 2000,
  symptoms: 5000,
  diagnosis: 5000,
  treatmentPlan: 5000,
  instructions: 5000,
  privateNotes: 10000,
};

const validateConsultationId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid consultation" });
  }
  next();
};

const validateQueueEntryId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.queueEntryId)) {
    return res.status(400).json({ message: "Invalid queue entry" });
  }
  next();
};

const validateConsultationDraft = (requireCompletion = false) => (
  req,
  res,
  next
) => {
  const body = req.body || {};
  const draft = {};

  for (const [field, maxLength] of Object.entries(TEXT_FIELDS)) {
    const value = body[field] == null ? "" : body[field];
    if (typeof value !== "string" || value.length > maxLength) {
      return res.status(400).json({ message: `Invalid ${field}` });
    }
    draft[field] = value.trim();
  }

  try {
    draft.vitals = normalizeVitals(body.vitals || {});
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  if (
    requireCompletion &&
    (!draft.diagnosis ||
      (!draft.treatmentPlan && !draft.instructions))
  ) {
    return res.status(400).json({
      message: "A diagnosis and either a treatment plan or patient instructions are required.",
    });
  }

  req.validatedConsultationDraft = draft;
  next();
};

const validateConsultationListQuery = (req, res, next) => {
  const status =
    typeof req.query.status === "string" ? req.query.status : "in_progress";
  if (!["in_progress", "completed"].includes(status)) {
    return res.status(400).json({ message: "Invalid consultation status" });
  }
  req.consultationStatus = status;
  next();
};

const validatePrescriptionDecision = (req, res, next) => {
  if (req.body?.decision !== "none_required") {
    return res.status(400).json({ message: "Invalid prescription decision" });
  }
  req.prescriptionDecision = "none_required";
  next();
};

module.exports = {
  validateConsultationId,
  validateQueueEntryId,
  validateConsultationDraft,
  validateConsultationListQuery,
  validatePrescriptionDecision,
};
