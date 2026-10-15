const VITAL_FIELDS = {
  systolic: { min: 0, max: 400, integer: true },
  diastolic: { min: 0, max: 300, integer: true },
  temperature: { min: 20, max: 50 },
  pulse: { min: 0, max: 300, integer: true },
  respiratoryRate: { min: 0, max: 100, integer: true },
  oxygenSaturation: { min: 0, max: 100 },
  weight: { min: 0, max: 1000 },
  height: { min: 0, max: 300 },
};

const normalizeVitals = (incomingVitals) => {
  if (
    !incomingVitals ||
    typeof incomingVitals !== "object" ||
    Array.isArray(incomingVitals)
  ) {
    throw new Error("Invalid vitals");
  }

  const vitals = {};
  for (const [field, constraints] of Object.entries(VITAL_FIELDS)) {
    const value = incomingVitals[field];
    if (value == null || value === "") {
      vitals[field] = null;
      continue;
    }
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < constraints.min ||
      value > constraints.max ||
      (constraints.integer && !Number.isInteger(value))
    ) {
      throw new Error(`Invalid ${field} value`);
    }
    vitals[field] = value;
  }
  return vitals;
};

module.exports = { VITAL_FIELDS, normalizeVitals };
