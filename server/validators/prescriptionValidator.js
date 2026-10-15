const mongoose = require("mongoose");

const TEXT_LIMITS = {
  medicationName: 200,
  dosage: 100,
  frequency: 200,
  route: 100,
  duration: 100,
  quantity: 100,
  instructions: 1000,
};

const requiredMedicationFields = [
  "medicationName",
  "dosage",
  "frequency",
  "duration",
];

const validatePrescriptionId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid prescription" });
  }
  next();
};

const validateConsultationId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.consultationId)) {
    return res.status(400).json({ message: "Invalid consultation" });
  }
  next();
};

const normalizePrescription = (body = {}) => {
  if (
    Object.hasOwn(body, "generalInstructions") &&
    typeof body.generalInstructions !== "string"
  ) {
    return { error: "General instructions must be text" };
  }
  if (
    typeof body.generalInstructions === "string" &&
    body.generalInstructions.length > 5000
  ) {
    return { error: "General instructions cannot exceed 5000 characters" };
  }
  if (!Array.isArray(body.medications) || body.medications.length > 50) {
    return { error: "Medications must be a list of no more than 50 items" };
  }

  const medications = [];
  for (const [index, medication] of body.medications.entries()) {
    if (!medication || typeof medication !== "object" || Array.isArray(medication)) {
      return { error: `Medication ${index + 1} is invalid` };
    }
    const normalized = {};
    for (const [field, maxLength] of Object.entries(TEXT_LIMITS)) {
      const value = medication[field] == null ? "" : medication[field];
      if (typeof value !== "string" || value.length > maxLength) {
        return { error: `Medication ${index + 1}: invalid ${field}` };
      }
      normalized[field] = value.trim();
    }
    for (const field of requiredMedicationFields) {
      if (!normalized[field]) {
        return {
          error: `Medication ${index + 1}: ${field} is required`,
        };
      }
    }
    if (
      normalized.quantity &&
      !/^\d+(?:\.\d+)?(?:\s*[A-Za-z][A-Za-z0-9 -]*)?$/.test(
        normalized.quantity
      )
    ) {
      return { error: `Medication ${index + 1}: invalid quantity` };
    }
    medications.push(normalized);
  }

  return {
    data: {
      ...(typeof body.generalInstructions === "string"
        ? { generalInstructions: body.generalInstructions.trim() }
        : {}),
      medications,
    },
  };
};

const validatePrescriptionDraft = (req, res, next) => {
  const result = normalizePrescription(req.body);
  if (result.error) return res.status(400).json({ message: result.error });
  req.validatedPrescription = result.data;
  next();
};

const validatePrescriptionIssue = (req, res, next) => {
  const result = normalizePrescription(req.body);
  if (result.error) return res.status(400).json({ message: result.error });
  if (!result.data.medications.length) {
    return res.status(400).json({
      message: "At least one medication is required to issue a prescription.",
    });
  }
  req.validatedPrescription = result.data;
  next();
};

const validatePrescriptionListQuery = (req, res, next) => {
  const status = typeof req.query.status === "string" ? req.query.status : "draft";
  if (!["draft", "issued"].includes(status)) {
    return res.status(400).json({ message: "Invalid prescription status" });
  }
  req.prescriptionStatus = status;
  next();
};

module.exports = {
  validatePrescriptionId,
  validateConsultationId,
  validatePrescriptionDraft,
  validatePrescriptionIssue,
  validatePrescriptionListQuery,
};
