const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

const validateService = (req, res, next) => {
  const body = req.body || {};
  const service = {
    name: cleanString(body.name),
    description: cleanString(body.description),
    fee: typeof body.fee === "number" ? body.fee : Number(body.fee),
    durationMinutes:
      typeof body.durationMinutes === "number"
        ? body.durationMinutes
        : Number(body.durationMinutes),
    status: cleanString(body.status) || "active",
  };

  if (!service.name || service.name.length > 100) {
    return res.status(400).json({ message: "Service name is required" });
  }
  if (!service.description || service.description.length > 1000) {
    return res.status(400).json({ message: "Description is required" });
  }
  if (!Number.isFinite(service.fee) || service.fee < 0) {
    return res.status(400).json({ message: "Fee must be zero or greater" });
  }
  if (!Number.isInteger(service.durationMinutes) || service.durationMinutes < 1) {
    return res.status(400).json({ message: "Duration must be a positive whole number" });
  }
  if (!["active", "inactive"].includes(service.status)) {
    return res.status(400).json({ message: "Invalid service status" });
  }

  req.validatedService = service;
  next();
};

module.exports = { validateService };
