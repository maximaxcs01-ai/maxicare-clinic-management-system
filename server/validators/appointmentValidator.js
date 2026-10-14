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

const validateDoctorAppointmentQuery = (req, res, next) => {
  const bucket =
    typeof req.query.bucket === "string" ? req.query.bucket : "today";
  if (!["today", "upcoming", "history"].includes(bucket)) {
    return res.status(400).json({ message: "Invalid appointment list filter" });
  }

  const date = typeof req.query.date === "string" ? req.query.date.trim() : "";
  if (date && !validDate(date)) {
    return res.status(400).json({ message: "Invalid date filter format (YYYY-MM-DD)" });
  }

  if (
    req.query.status &&
    ![
      "pending",
      "confirmed",
      "checked_in",
      "waiting",
      "cancelled",
      "rejected",
    ].includes(req.query.status)
  ) {
    return res.status(400).json({ message: "Invalid status filter" });
  }

  req.doctorAppointmentBucket = bucket;
  req.doctorAppointmentQuery = { ...req.query, date };
  next();
};

const validateStaffAppointmentQuery = (req, res, next) => {
  const { status, date } = req.query;
  if (status && typeof status === "string") {
    const validStatuses = [
      "pending",
      "confirmed",
      "checked_in",
      "waiting",
      "in_consultation",
      "completed",
      "cancelled",
      "rejected",
      "no_show",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status filter" });
    }
  }
  if (date && typeof date === "string" && !validDate(date)) {
    return res.status(400).json({ message: "Invalid date filter format (YYYY-MM-DD)" });
  }
  next();
};

const validateAppointmentRejection = (req, res, next) => {
  const reason = typeof req.body?.rejectionReason === "string" ? req.body.rejectionReason.trim() : "";
  if (!reason) {
    return res.status(400).json({ message: "A rejection reason is required" });
  }
  if (reason.length > 500) {
    return res.status(400).json({ message: "Rejection reason cannot exceed 500 characters" });
  }
  req.validatedRejection = { rejectionReason: reason };
  next();
};

const validateAppointmentCancellation = (req, res, next) => {
  const reason = typeof req.body?.cancellationReason === "string" ? req.body.cancellationReason.trim() : "";
  if (reason.length > 500) {
    return res.status(400).json({ message: "Cancellation reason cannot exceed 500 characters" });
  }
  req.validatedCancellation = { cancellationReason: reason };
  next();
};

const validateAppointmentReschedule = (req, res, next) => {
  const body = req.body || {};
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const time = typeof body.time === "string" ? body.time.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";

  if (!validDate(date)) {
    return res.status(400).json({ message: "Please provide a valid appointment date" });
  }

  if (!TIME_PATTERN.test(time)) {
    return res.status(400).json({ message: "Please select a valid appointment time" });
  }

  if (reason.length > 500) {
    return res.status(400).json({ message: "Reason cannot exceed 500 characters" });
  }

  if (overrideReason.length > 500) {
    return res.status(400).json({ message: "Override reason cannot exceed 500 characters" });
  }

  req.validatedReschedule = { date, time, reason, overrideReason };
  next();
};

module.exports = {
  validateAppointmentBooking,
  validateAppointmentListQuery,
  validateDoctorAppointmentQuery,
  validateStaffAppointmentQuery,
  validateAppointmentRejection,
  validateAppointmentCancellation,
  validateAppointmentReschedule,
};
