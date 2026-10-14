const mongoose = require("mongoose");
const { validateWalkInPatient } = require("./patientValidator");

const validateWalkIn = (req, res, next) => {
  const body = req.body || {};
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
  const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
  const hasNewPatient = body.newPatient && typeof body.newPatient === "object";

  if (!mongoose.isValidObjectId(serviceId)) {
    return res.status(400).json({ message: "Select a valid service" });
  }
  if (Boolean(patientId) === Boolean(hasNewPatient)) {
    return res.status(400).json({
      message: "Select an existing patient or provide details for a new patient",
    });
  }
  if (patientId && !mongoose.isValidObjectId(patientId)) {
    return res.status(400).json({ message: "Select a valid patient" });
  }

  let newPatient;
  if (hasNewPatient) {
    const result = validateWalkInPatient(body.newPatient);
    if (result.error) return res.status(400).json({ message: result.error });
    newPatient = result.data;
  }

  req.validatedWalkIn = { serviceId, patientId: patientId || null, newPatient };
  next();
};

const validateWalkInServiceQuery = (req, res, next) => {
  const serviceId =
    typeof req.query.serviceId === "string" ? req.query.serviceId.trim() : "";
  if (!mongoose.isValidObjectId(serviceId)) {
    return res.status(400).json({ message: "Select a valid service" });
  }
  req.walkInServiceId = serviceId;
  next();
};

module.exports = { validateWalkIn, validateWalkInServiceQuery };
