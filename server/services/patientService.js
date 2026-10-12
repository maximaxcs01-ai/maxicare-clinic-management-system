const Patient = require("../models/Patient");
const AppError = require("../utils/AppError");
const { getNextPatientNumber } = require("./patientNumberService");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");

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

const findPatientById = (id) => Patient.findById(id);
const findOwnPatient = (userId) => Patient.findOne({ userId });

const createPatient = async (data) => {
  const patientNumber = await getNextPatientNumber();
  return Patient.create({ ...data, patientNumber });
};

const updatePatient = (id, data) => Patient.findByIdAndUpdate(id, data, { new: true, runValidators: true });
const updateOwnPatient = (userId, data) => Patient.findOneAndUpdate({ userId }, data, { new: true, runValidators: true });

const deletePatient = async (id) => {
  const patient = await Patient.findById(id);
  if (!patient) return null;
  if (patient.userId) throw new AppError("Portal-linked patients cannot be deleted", 409);
  return Patient.findByIdAndDelete(id);
};

module.exports = { findPatients, findPatientById, findOwnPatient, createPatient, updatePatient, updateOwnPatient, deletePatient };
