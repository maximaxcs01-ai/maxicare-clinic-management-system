const mongoose = require("mongoose");

const validateObjectIdParam = (parameter) => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[parameter])) {
    return res.status(400).json({ message: `Invalid ${parameter}` });
  }
  next();
};

const validateQueueRemoval = (req, res, next) => {
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    return res.status(400).json({ message: "A removal reason is required" });
  }
  if (reason.length > 500) {
    return res.status(400).json({ message: "Removal reason cannot exceed 500 characters" });
  }
  req.validatedRemovalReason = reason;
  next();
};

module.exports = { validateObjectIdParam, validateQueueRemoval };
