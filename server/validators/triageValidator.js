const { normalizeVitals } = require("./vitalsValidator");

const validateTriageVitals = (req, res, next) => {
  try {
    req.validatedTriageVitals = normalizeVitals(req.body?.vitals);
    next();
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { validateTriageVitals };
