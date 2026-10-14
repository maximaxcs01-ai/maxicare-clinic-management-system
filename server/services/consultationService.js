const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const QueueEntry = require("../models/QueueEntry");
const AppError = require("../utils/AppError");
const { buildPagination, getPagination } = require("../utils/pagination");

const CONSULTATION_DUPLICATE_INDEX = "consultation_appointment_unique";

const isDuplicateConsultation = (error) =>
  error.code === 11000 &&
  error.message.includes(CONSULTATION_DUPLICATE_INDEX);

const assertObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
};

const getDoctorForUser = async (userId) => {
  const doctor = await Doctor.findOne({ userId }).select("_id");
  if (!doctor) throw new AppError("Doctor profile not found", 404);
  return doctor;
};

const populateConsultation = (query) =>
  query
    .populate("patientId", "patientNumber firstName middleName lastName dateOfBirth sex")
    .populate("serviceId", "name durationMinutes")
    .populate("appointmentId", "bookingType");

const startConsultation = async (queueEntryId, user) => {
  assertObjectId(queueEntryId, "queue entry");
  const doctor = await getDoctorForUser(user._id);
  const session = await mongoose.startSession();
  let consultationId;

  try {
    await session.withTransaction(async () => {
      const queueEntry = await QueueEntry.findOne({
        _id: queueEntryId,
        doctorId: doctor._id,
        queueStatus: "called",
        active: true,
      }).session(session);
      if (!queueEntry) {
        throw new AppError(
          "Only a called queue entry assigned to you can start a consultation.",
          409
        );
      }

      const appointment = await Appointment.findOne({
        _id: queueEntry.appointmentId,
        doctorId: doctor._id,
        status: "waiting",
      }).session(session);
      if (!appointment) {
        throw new AppError(
          "The appointment must be waiting and assigned to you.",
          409
        );
      }

      const existing = await Consultation.exists({
        appointmentId: appointment._id,
      }).session(session);
      if (existing) {
        throw new AppError("A consultation already exists for this appointment.", 409);
      }

      const startedAt = new Date();
      const [consultation] = await Consultation.create(
        [
          {
            appointmentId: appointment._id,
            patientId: appointment.patientId,
            doctorId: doctor._id,
            serviceId: appointment.serviceId,
            status: "in_progress",
            startedAt,
            createdBy: user._id,
            updatedBy: user._id,
          },
        ],
        { session }
      );

      appointment.status = "in_consultation";
      appointment.statusHistory.push({
        status: "in_consultation",
        changedAt: startedAt,
        changedBy: user._id,
        role: user.role,
        reason: "Consultation started",
      });
      await appointment.save({ session });

      queueEntry.queueStatus = "in_consultation";
      queueEntry.active = false;
      await queueEntry.save({ session });
      consultationId = consultation._id;
    });
  } catch (error) {
    if (isDuplicateConsultation(error)) {
      throw new AppError("A consultation already exists for this appointment.", 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return getConsultation(consultationId, user);
};

const getConsultation = async (consultationId, user) => {
  assertObjectId(consultationId, "consultation");
  const doctor = await getDoctorForUser(user._id);
  const consultation = await populateConsultation(
    Consultation.findOne({ _id: consultationId, doctorId: doctor._id })
  );
  if (!consultation) throw new AppError("Consultation not found", 404);
  return consultation;
};

const listConsultations = async (user, query) => {
  const doctor = await getDoctorForUser(user._id);
  const { page, limit, skip } = getPagination(query);
  const status = query.status === "completed" ? "completed" : "in_progress";
  const filter = { doctorId: doctor._id, status };
  const [data, total] = await Promise.all([
    populateConsultation(
      Consultation.find(filter)
        .sort({ startedAt: status === "completed" ? -1 : 1 })
        .skip(skip)
        .limit(limit)
    ),
    Consultation.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const saveDraft = async (consultationId, user, draft) => {
  assertObjectId(consultationId, "consultation");
  const doctor = await getDoctorForUser(user._id);
  const update = {
    ...draft,
    updatedBy: user._id,
  };
  const consultation = await Consultation.findOneAndUpdate(
    {
      _id: consultationId,
      doctorId: doctor._id,
      status: "in_progress",
    },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!consultation) {
    const existing = await Consultation.findOne({
      _id: consultationId,
      doctorId: doctor._id,
    }).select("status");
    if (!existing) throw new AppError("Consultation not found", 404);
    throw new AppError("Completed consultations are read-only.", 409);
  }
  return populateConsultation(
    Consultation.findOne({ _id: consultationId, doctorId: doctor._id })
  );
};

const completeConsultation = async (consultationId, user, draft) => {
  assertObjectId(consultationId, "consultation");
  if (
    !draft.diagnosis?.trim() ||
    (!draft.treatmentPlan?.trim() && !draft.instructions?.trim())
  ) {
    throw new AppError(
      "A diagnosis and either a treatment plan or patient instructions are required.",
      400
    );
  }
  const doctor = await getDoctorForUser(user._id);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const consultation = await Consultation.findOne({
        _id: consultationId,
        doctorId: doctor._id,
        status: "in_progress",
      }).session(session);
      if (!consultation) {
        const exists = await Consultation.exists({
          _id: consultationId,
          doctorId: doctor._id,
        }).session(session);
        if (!exists) throw new AppError("Consultation not found", 404);
        throw new AppError("Completed consultations are read-only.", 409);
      }

      const appointment = await Appointment.findOne({
        _id: consultation.appointmentId,
        doctorId: doctor._id,
        status: "in_consultation",
      }).session(session);
      if (!appointment) {
        throw new AppError("The appointment is not in consultation.", 409);
      }

      const queueEntry = await QueueEntry.findOne({
        appointmentId: appointment._id,
        doctorId: doctor._id,
        queueStatus: "in_consultation",
        active: false,
      }).session(session);
      if (!queueEntry) {
        throw new AppError("Consultation queue record was not found.", 409);
      }

      for (const field of [
        "chiefComplaint",
        "symptoms",
        "diagnosis",
        "treatmentPlan",
        "instructions",
        "privateNotes",
      ]) {
        consultation[field] = draft[field];
      }
      consultation.vitals = draft.vitals;
      consultation.status = "completed";
      consultation.completedAt = new Date();
      consultation.updatedBy = user._id;
      await consultation.save({ session });

      appointment.status = "completed";
      appointment.statusHistory.push({
        status: "completed",
        changedAt: consultation.completedAt,
        changedBy: user._id,
        role: user.role,
        reason: "Consultation completed",
      });
      await appointment.save({ session });

      queueEntry.queueStatus = "completed";
      queueEntry.active = false;
      await queueEntry.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return getConsultation(consultationId, user);
};

module.exports = {
  startConsultation,
  getConsultation,
  listConsultations,
  saveDraft,
  completeConsultation,
};
