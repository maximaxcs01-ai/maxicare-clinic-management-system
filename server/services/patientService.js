const Patient = require("../models/Patient");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const AppError = require("../utils/AppError");
const { getNextPatientNumber } = require("./patientNumberService");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");
const mongoose = require("mongoose");

const findPatients = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { patientNumber: pattern }, { firstName: pattern }, { middleName: pattern },
      { lastName: pattern }, { email: pattern }, { mobileNumber: pattern },
      { contactNumber: pattern },
    ];
  }
  if (["not_activated", "invited", "active", "inactive"].includes(query.portalStatus)) {
    filter.portalStatus = query.portalStatus;
  }
  const [data, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const searchWalkInPatients = async (query) => {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search.length < 2) {
    return { data: [], pagination: buildPagination(1, 10, 0) };
  }

  const { page, limit, skip } = getPagination({ ...query, limit: Math.min(Number(query.limit) || 10, 25) });
  const pattern = new RegExp(escapeRegex(search), "i");
  const filter = {
    $or: [
      { patientNumber: pattern },
      { firstName: pattern },
      { middleName: pattern },
      { lastName: pattern },
      { mobileNumber: pattern },
      { contactNumber: pattern },
      { email: pattern },
    ],
  };
  if (mongoose.isValidObjectId(search)) filter.$or.push({ _id: search });

  const [data, total] = await Promise.all([
    Patient.find(filter)
      .select("patientNumber firstName middleName lastName suffix mobileNumber contactNumber email portalStatus")
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const findPatientById = (id) => Patient.findById(id);
const findOwnPatient = (userId) => Patient.findOne({ userId });

const createPatient = async (data, session) => {
  const patientNumber = await getNextPatientNumber(session);
  if (session) {
    const [patient] = await Patient.create([{ ...data, patientNumber }], { session });
    return patient;
  }
  return Patient.create({ ...data, patientNumber });
};

const updatePatient = (id, data) => Patient.findByIdAndUpdate(id, data, { new: true, runValidators: true });
const updateOwnPatient = (userId, data) => Patient.findOneAndUpdate({ userId }, data, { new: true, runValidators: true });

const deletePatient = async (id) => {
  const patient = await Patient.findById(id);
  if (!patient) return null;
  if (patient.userId) throw new AppError("Portal-linked patients cannot be deleted", 409);
  const [hasAppointments, hasConsultations] = await Promise.all([
    Appointment.exists({ patientId: id }),
    Consultation.exists({ patientId: id }),
  ]);
  if (hasAppointments || hasConsultations) {
    throw new AppError("Patients with medical or appointment history cannot be deleted", 409);
  }
  return Patient.findByIdAndDelete(id);
};

module.exports = { findPatients, searchWalkInPatients, findPatientById, findOwnPatient, createPatient, updatePatient, updateOwnPatient, deletePatient };
