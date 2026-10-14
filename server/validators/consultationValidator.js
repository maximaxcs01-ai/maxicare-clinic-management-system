const mongoose = require("mongoose");

const TEXT_FIELDS = {
  chiefComplaint: 2000,
  symptoms: 5000,
  diagnosis: 5000,
  treatmentPlan: 5000,
  instructions: 5000,
  privateNotes: 10000,
};

const VITALS = {
  systolic: { min: 0, max: 400, integer: true },
  diastolic: { min: 0, max: 300, integer: true },
  temperature: { min: 20, max: 50 },
  pulse: { min: 0, max: 300, integer: true },
  respiratoryRate: { min: 0, max: 100, integer: true },
  oxygenSaturation: { min: 0, max: 100 },
  weight: { min: 0, max: 1000 },
  height: { min: 0, max: 300 },
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

  const incomingVitals = body.vitals || {};
  if (
    typeof incomingVitals !== "object" ||
    Array.isArray(incomingVitals)
  ) {
    return res.status(400).json({ message: "Invalid vitals" });
  }

  draft.vitals = {};
  for (const [field, constraints] of Object.entries(VITALS)) {
    const value = incomingVitals[field];
    if (value == null || value === "") {
      draft.vitals[field] = null;
      continue;
    }
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < constraints.min ||
      value > constraints.max ||
      (constraints.integer && !Number.isInteger(value))
    ) {
      return res.status(400).json({ message: `Invalid ${field} value` });
    }
    draft.vitals[field] = value;
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

module.exports = {
  validateConsultationId,
  validateQueueEntryId,
  validateConsultationDraft,
  validateConsultationListQuery,
};
