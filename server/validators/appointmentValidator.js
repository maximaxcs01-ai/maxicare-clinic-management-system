const mongoose = require("mongoose");
const { validDate, TIME_PATTERN } = require("./scheduleValidator");

const validateAppointmentBooking = (req, res, next) => {
  const body = req.body || {};
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
  const doctorId = typeof body.doctorId === "string" ? body.doctorId.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const time = typeof body.time === "string" ? body.time.trim() : "";
  const reasonForVisit =
    typeof body.reasonForVisit === "string" ? body.reasonForVisit.trim() : "";

  if (!mongoose.isValidObjectId(serviceId) || !mongoose.isValidObjectId(doctorId)) {
    return res.status(400).json({ message: "Select a valid service and doctor" });
  }

  if (!validDate(date)) {
    return res.status(400).json({ message: "Please provide a valid appointment date" });
  }

  if (!TIME_PATTERN.test(time)) {
    return res.status(400).json({ message: "Please select a valid appointment time" });
  }

  if (reasonForVisit.length > 1000) {
    return res.status(400).json({ message: "Reason for visit cannot exceed 1000 characters" });
  }

  req.validatedAppointment = { serviceId, doctorId, date, time, reasonForVisit };
  next();
};

const validateAppointmentListQuery = (req, res, next) => {
  const bucket = typeof req.query.bucket === "string" ? req.query.bucket : "upcoming";
  if (!["upcoming", "history"].includes(bucket)) {
    return res.status(400).json({ message: "Invalid appointment list filter" });
  }
  req.appointmentBucket = bucket;
  next();
};

module.exports = { validateAppointmentBooking, validateAppointmentListQuery };
