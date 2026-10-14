const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Prescription = require("../models/Prescription");
const AppError = require("../utils/AppError");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");

const PATIENT_FIELDS =
  "patientNumber firstName middleName lastName suffix dateOfBirth sex gender mobileNumber contactNumber email address";
const CONSULTATION_FIELDS =
  "appointmentId patientId doctorId serviceId status startedAt completedAt chiefComplaint symptoms vitals diagnosis treatmentPlan instructions createdAt";

const assertObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label}`, 400);
};

const getPatientForUser = async (userId) => {
  const patient = await Patient.findOne({ userId }).select(PATIENT_FIELDS);
  if (!patient) throw new AppError("Patient profile not found", 404);
  return patient;
};

const populateConsultation = (query) =>
  query
    .populate("doctorId", "doctorNumber firstName middleName lastName")
    .populate("serviceId", "name")
    .populate("appointmentId", "bookingType startAt endAt");

const populatePrescription = (query) =>
  query
    .populate("doctorId", "doctorNumber firstName middleName lastName")
    .populate("serviceId", "name")
    .populate("appointmentId", "bookingType startAt")
    .populate({
      path: "consultationId",
      select: "diagnosis treatmentPlan instructions completedAt",
    });

const getPatientHistory = async (user) => {
  const patient = await getPatientForUser(user._id);
  const [consultations, appointments, prescriptions] = await Promise.all([
    populateConsultation(
      Consultation.find({ patientId: patient._id, status: "completed" })
        .select(CONSULTATION_FIELDS)
        .sort({ completedAt: -1 })
    ),
    Appointment.find({ patientId: patient._id })
      .select("startAt endAt status bookingType reasonForVisit checkedInAt")
      .populate("doctorId", "doctorNumber firstName middleName lastName")
      .populate("serviceId", "name")
      .sort({ startAt: -1 }),
    populatePrescription(
      Prescription.find({ patientId: patient._id, status: "issued" })
        .select("consultationId appointmentId doctorId serviceId status issuedAt generalInstructions medications createdAt")
        .sort({ issuedAt: -1 })
    ),
  ]);
  return { patient, consultations, appointments, prescriptions };
};

const getOwnCompletedConsultation = async (consultationId, user) => {
  assertObjectId(consultationId, "consultation");
  const patient = await getPatientForUser(user._id);
  const consultation = await populateConsultation(
    Consultation.findOne({
      _id: consultationId,
      patientId: patient._id,
      status: "completed",
    }).select(CONSULTATION_FIELDS)
  );
  if (!consultation) throw new AppError("Completed consultation not found", 404);
  const prescription = await populatePrescription(
    Prescription.findOne({
      consultationId: consultation._id,
      patientId: patient._id,
      status: "issued",
    }).select("consultationId appointmentId serviceId status issuedAt generalInstructions medications createdAt")
  );
  return { consultation, prescription };
};

const getDoctorForUser = async (userId) => {
  const doctor = await Doctor.findOne({ userId }).select("_id");
  if (!doctor) throw new AppError("Doctor profile not found", 404);
  return doctor;
};

const listDoctorPatients = async (user, query) => {
  const doctor = await getDoctorForUser(user._id);
  const { page, limit, skip } = getPagination(query);
  const patientIds = await Appointment.distinct("patientId", {
    doctorId: doctor._id,
  });
  const filter = { _id: { $in: patientIds } };
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$and = [
      {
        $or: [
          { patientNumber: pattern },
          { firstName: pattern },
          { middleName: pattern },
          { lastName: pattern },
          { mobileNumber: pattern },
          { contactNumber: pattern },
        ],
      },
    ];
  }
  const [data, total] = await Promise.all([
    Patient.find(filter)
      .select("patientNumber firstName middleName lastName suffix dateOfBirth sex gender mobileNumber contactNumber")
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(limit),
    Patient.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const getDoctorPatientRecord = async (patientId, user) => {
  assertObjectId(patientId, "patient");
  const doctor = await getDoctorForUser(user._id);
  const hasCareRelationship = await Appointment.exists({
    patientId,
    doctorId: doctor._id,
  });
  if (!hasCareRelationship) throw new AppError("Patient record not found", 404);

  const patient = await Patient.findById(patientId).select(PATIENT_FIELDS);
  if (!patient) throw new AppError("Patient record not found", 404);

  const [ownConsultations, otherConsultations] = await Promise.all([
    populateConsultation(
      Consultation.find({
        patientId,
        doctorId: doctor._id,
        status: "completed",
      })
        .select(`${CONSULTATION_FIELDS} privateNotes`)
        .sort({ completedAt: -1 })
    ),
    populateConsultation(
      Consultation.find({
        patientId,
        doctorId: { $ne: doctor._id },
        status: "completed",
      })
        .select(CONSULTATION_FIELDS)
        .sort({ completedAt: -1 })
    ),
  ]);
  const consultations = [...ownConsultations, ...otherConsultations].sort(
    (left, right) =>
      new Date(right.completedAt).getTime() -
      new Date(left.completedAt).getTime()
  );
  const prescriptions = await populatePrescription(
    Prescription.find({ patientId, status: "issued" })
      .select("consultationId appointmentId serviceId status issuedAt generalInstructions medications createdAt")
      .sort({ issuedAt: -1 })
  );
  return { patient, consultations, prescriptions };
};

module.exports = {
  getPatientHistory,
  getOwnCompletedConsultation,
  listDoctorPatients,
  getDoctorPatientRecord,
};
