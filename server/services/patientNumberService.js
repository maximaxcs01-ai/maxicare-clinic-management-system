const Counter = require("../models/Counter");

const getNextPatientNumber = async (session) => {
  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };

  if (session) options.session = session;

  const counter = await Counter.findByIdAndUpdate(
    "patientNumber",
    { $inc: { sequence: 1 } },
    options
  );

  return `PT-${String(counter.sequence).padStart(6, "0")}`;
};

module.exports = { getNextPatientNumber };
