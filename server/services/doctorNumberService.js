const Counter = require("../models/Counter");

const getNextDoctorNumber = async (session) => {
  const counter = await Counter.findByIdAndUpdate(
    "doctorNumber",
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  return `DR-${String(counter.sequence).padStart(6, "0")}`;
};

module.exports = { getNextDoctorNumber };
