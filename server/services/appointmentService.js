const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Service = require("../models/Service");
const AppError = require("../utils/AppError");
const { getPagination, buildPagination } = require("../utils/pagination");
const { getDoctorAvailability, toManilaDateTime, SLOT_DURATION_MINUTES } = require("./availabilityService");

const SLOT_UNAVAILABLE_MESSAGE = "The selected appointment slot is no longer available.";
const TERMINAL_STATUSES = ["cancelled", "rejected", "completed", "no_show"];

const createPatientAppointment = async (user, input) => {
  const patient = await Patient.findOne({ userId: user._id }).select("_id");
  if (!patient) throw new AppError("Patient profile not found", 404);

  const [service, doctor] = await Promise.all([
    Service.findById(input.serviceId).select("status"),
    Doctor.findById(input.doctorId).select("status serviceIds"),
  ]);

  if (!service || service.status !== "active") {
    throw new AppError("The selected service is unavailable", 409);
  }
  if (!doctor || doctor.status !== "active") {
    throw new AppError("The selected doctor is unavailable", 409);
  }
  if (!doctor.serviceIds.some((id) => String(id) === input.serviceId)) {
    throw new AppError("The selected doctor does not support this service", 409);
  }

  const availability = await getDoctorAvailability({
    doctorId: input.doctorId,
    date: input.date,
    serviceId: input.serviceId,
  });
  if (!availability.slots.some((slot) => slot.time === input.time && slot.available)) {
    throw new AppError(SLOT_UNAVAILABLE_MESSAGE, 409);
  }

  const startAt = toManilaDateTime(input.date, input.time);
  const endAt = new Date(startAt.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

  try {
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      serviceId: service._id,
      startAt,
      endAt,
      status: "pending",
      bookingType: "scheduled",
      reasonForVisit: input.reasonForVisit,
      slotReserved: true,
      createdBy: user._id,
    });

    await appointment.populate([
      { path: "doctorId", select: "doctorNumber firstName middleName lastName specialization" },
      { path: "serviceId", select: "name description durationMinutes fee" },
    ]);
    return appointment;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(SLOT_UNAVAILABLE_MESSAGE, 409);
    }
    throw error;
  }
};

const listPatientAppointments = async (patientId, query, bucket) => {
  const { page, limit, skip } = getPagination(query);
  const now = new Date();
  const filter = { patientId };

  if (bucket === "upcoming") {
    filter.startAt = { $gte: now };
    filter.status = { $nin: TERMINAL_STATUSES };
  } else {
    filter.$or = [
      { startAt: { $lt: now } },
      { status: { $in: TERMINAL_STATUSES } },
    ];
  }

  const [data, total] = await Promise.all([
    Appointment.find(filter)
      .populate("doctorId", "doctorNumber firstName middleName lastName specialization")
      .populate("serviceId", "name description durationMinutes fee")
      .sort({ startAt: bucket === "upcoming" ? 1 : -1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
};

const getPatientAppointment = async (patientId, appointmentId) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patientId,
  })
    .populate("doctorId", "doctorNumber firstName middleName lastName specialization")
    .populate("serviceId", "name description durationMinutes fee");
  if (!appointment) throw new AppError("Appointment not found", 404);
  return appointment;
};

const getPatientForUser = async (userId) => {
  const patient = await Patient.findOne({ userId }).select("_id");
  if (!patient) throw new AppError("Patient profile not found", 404);
  return patient;
};

module.exports = {
  SLOT_UNAVAILABLE_MESSAGE,
  createPatientAppointment,
  listPatientAppointments,
  getPatientAppointment,
  getPatientForUser,
};
