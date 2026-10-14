const mongoose = require("mongoose");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Prescription = require("../models/Prescription");
const AppError = require("../utils/AppError");
const { buildPagination, getPagination } = require("../utils/pagination");

const DUPLICATE_PRESCRIPTION_INDEX = "prescription_consultation_unique";

const prescriptionPopulation = (query) =>
  query
    .populate("patientId", "patientNumber firstName middleName lastName")
    .populate("serviceId", "name")
    .populate("appointmentId", "bookingType startAt")
    .populate({
      path: "consultationId",
      select: "diagnosis treatmentPlan instructions status startedAt",
    });

const getDoctorForUser = async (userId) => {
  const doctor = await Doctor.findOne({ userId }).select("_id");
  if (!doctor) throw new AppError("Doctor profile not found", 404);
  return doctor;
};

const getOwnedConsultation = async (consultationId, doctorId) => {
  if (!mongoose.isValidObjectId(consultationId)) {
    throw new AppError("Invalid consultation", 400);
  }
  const consultation = await Consultation.findOne({
    _id: consultationId,
    doctorId,
  }).select("_id appointmentId patientId doctorId serviceId status");
  if (!consultation) throw new AppError("Consultation not found", 404);
  if (!["in_progress", "completed"].includes(consultation.status)) {
    throw new AppError("Prescription is not available for this consultation.", 409);
  }
  return consultation;
};

const createPrescription = async (consultationId, user) => {
  const doctor = await getDoctorForUser(user._id);
  const consultation = await getOwnedConsultation(consultationId, doctor._id);
  if (await Prescription.exists({ consultationId: consultation._id })) {
    throw new AppError(
      "A prescription already exists for this consultation.",
      409
    );
  }
  try {
    const prescription = await Prescription.create({
      consultationId: consultation._id,
      appointmentId: consultation.appointmentId,
      patientId: consultation.patientId,
      serviceId: consultation.serviceId,
      doctorId: doctor._id,
      status: "draft",
      createdBy: user._id,
      updatedBy: user._id,
    });
    return prescriptionPopulation(
      Prescription.findOne({ _id: prescription._id, doctorId: doctor._id })
    );
  } catch (error) {
    if (
      error.code === 11000 &&
      error.message.includes(DUPLICATE_PRESCRIPTION_INDEX)
    ) {
      throw new AppError(
        "A prescription already exists for this consultation.",
        409
      );
    }
    throw error;
  }
};

const getPrescriptionForConsultation = async (consultationId, user) => {
  const doctor = await getDoctorForUser(user._id);
  await getOwnedConsultation(consultationId, doctor._id);
  const prescription = await prescriptionPopulation(
    Prescription.findOne({
      consultationId,
      doctorId: doctor._id,
    })
  );
  if (!prescription) throw new AppError("Prescription not found", 404);
  return prescription;
};

const listPrescriptions = async (user, query) => {
  const doctor = await getDoctorForUser(user._id);
  const { page, limit, skip } = getPagination(query);
  const filter = { doctorId: doctor._id, status: query.status };
  const [data, total] = await Promise.all([
    prescriptionPopulation(
      Prescription.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
    ),
    Prescription.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const getPrescription = async (prescriptionId, user) => {
  if (!mongoose.isValidObjectId(prescriptionId)) {
    throw new AppError("Invalid prescription", 400);
  }
  const doctor = await getDoctorForUser(user._id);
  const prescription = await prescriptionPopulation(
    Prescription.findOne({ _id: prescriptionId, doctorId: doctor._id })
  );
  if (!prescription) throw new AppError("Prescription not found", 404);
  return prescription;
};

const saveDraft = async (prescriptionId, user, data) => {
  if (!mongoose.isValidObjectId(prescriptionId)) {
    throw new AppError("Invalid prescription", 400);
  }
  const doctor = await getDoctorForUser(user._id);
  const prescription = await Prescription.findOneAndUpdate(
    {
      _id: prescriptionId,
      doctorId: doctor._id,
      status: "draft",
    },
    {
      $set: {
        medications: data.medications,
        generalInstructions: data.generalInstructions,
        updatedBy: user._id,
      },
    },
    { new: true, runValidators: true }
  );
  if (!prescription) {
    const existing = await Prescription.exists({
      _id: prescriptionId,
      doctorId: doctor._id,
    });
    if (!existing) throw new AppError("Prescription not found", 404);
    throw new AppError("Issued prescriptions are read-only.", 409);
  }
  return prescriptionPopulation(
    Prescription.findOne({ _id: prescriptionId, doctorId: doctor._id })
  );
};

const issuePrescription = async (prescriptionId, user, data) => {
  if (!mongoose.isValidObjectId(prescriptionId)) {
    throw new AppError("Invalid prescription", 400);
  }
  if (!data.medications.length) {
    throw new AppError(
      "At least one medication is required to issue a prescription.",
      400
    );
  }
  const doctor = await getDoctorForUser(user._id);
  const ownedPrescription = await Prescription.findOne({
    _id: prescriptionId,
    doctorId: doctor._id,
  }).select("consultationId status");
  if (!ownedPrescription) throw new AppError("Prescription not found", 404);
  if (ownedPrescription.status !== "draft") {
    throw new AppError("Only draft prescriptions can be issued.", 409);
  }
  await getOwnedConsultation(ownedPrescription.consultationId, doctor._id);
  const prescription = await Prescription.findOneAndUpdate(
    {
      _id: prescriptionId,
      doctorId: doctor._id,
      status: "draft",
    },
    {
      $set: {
        medications: data.medications,
        generalInstructions: data.generalInstructions,
        status: "issued",
        issuedAt: new Date(),
        updatedBy: user._id,
      },
    },
    { new: true, runValidators: true }
  );
  if (!prescription) {
    const existing = await Prescription.findOne({
      _id: prescriptionId,
      doctorId: doctor._id,
    }).select("status medications");
    if (!existing) throw new AppError("Prescription not found", 404);
    if (existing.status !== "draft") {
      throw new AppError("Only draft prescriptions can be issued.", 409);
    }
    if (!existing.medications?.length) {
      throw new AppError(
        "At least one medication is required to issue a prescription.",
        400
      );
    }
    throw new AppError("Prescription could not be issued.", 409);
  }
  return prescriptionPopulation(
    Prescription.findOne({ _id: prescriptionId, doctorId: doctor._id })
  );
};

module.exports = {
  createPrescription,
  getPrescriptionForConsultation,
  listPrescriptions,
  getPrescription,
  saveDraft,
  issuePrescription,
};
