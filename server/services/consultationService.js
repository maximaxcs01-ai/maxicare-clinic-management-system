const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Prescription = require("../models/Prescription");
const QueueEntry = require("../models/QueueEntry");
const AppError = require("../utils/AppError");
const { buildPagination, getPagination } = require("../utils/pagination");
const { recordAudit } = require("./auditService");

const CONSULTATION_DUPLICATE_INDEX =
  "consultation_active_appointment_unique";
const ACTIVE_QUEUE_STATUSES = ["waiting", "called"];
const FINALIZED_HISTORY_DELETE_MESSAGE =
  "This consultation cannot be deleted because it is part of finalized medical history.";

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
    .populate("appointmentId", "bookingType")
    .populate("triageRecordedBy", "firstName lastName role");

const startConsultation = async (queueEntryId, user, request) => {
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
        status: { $in: ["in_progress", "completed"] },
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
            vitals:
              appointment.triage?.vitals?.toObject?.() ||
              appointment.triage?.vitals ||
              undefined,
            triageRecordedBy: appointment.triage?.recordedBy || null,
            triageRecordedAt: appointment.triage?.recordedAt || null,
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
      if (request) {
        await recordAudit(
          {
            actorUserId: user._id,
            actorRole: user.role,
            action: "consultation.started",
            entityType: "Consultation",
            entityId: consultation._id,
            patientId: consultation.patientId,
            description: "Consultation started.",
            metadata: {
              patientId: consultation.patientId,
              appointmentId: appointment._id,
              status: consultation.status,
            },
          },
          request,
          session
        );
      }
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
    Consultation.findOne({
      _id: consultationId,
      doctorId: doctor._id,
      status: { $in: ["in_progress", "completed"] },
    })
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
    throw new AppError("Only in-progress consultations can be changed.", 409);
  }
  return populateConsultation(
    Consultation.findOne({ _id: consultationId, doctorId: doctor._id })
  );
};

const markNoPrescriptionNeeded = async (consultationId, user, request) => {
  assertObjectId(consultationId, "consultation");
  const doctor = await getDoctorForUser(user._id);
  const issuedPrescription = await Prescription.exists({
    consultationId,
    doctorId: doctor._id,
    status: "issued",
  });
  if (issuedPrescription) {
    throw new AppError(
      "An issued prescription already resolves this consultation.",
      409
    );
  }

  const consultation = await Consultation.findOneAndUpdate(
    {
      _id: consultationId,
      doctorId: doctor._id,
      status: "in_progress",
    },
    {
      $set: {
        prescriptionDecision: "none_required",
        updatedBy: user._id,
      },
    },
    { new: true, runValidators: true }
  );
  if (!consultation) {
    const existing = await Consultation.findOne({
      _id: consultationId,
      doctorId: doctor._id,
    }).select("status");
    if (!existing) throw new AppError("Consultation not found", 404);
    throw new AppError("Only in-progress consultations can be changed.", 409);
  }

  if (request) {
    await recordAudit(
      {
        actorUserId: user._id,
        actorRole: user.role,
        action: "consultation.no_prescription_needed",
        entityType: "Consultation",
        entityId: consultation._id,
        patientId: consultation.patientId,
        description: "No prescription needed decision recorded.",
        metadata: {
          consultationId: consultation._id,
          patientId: consultation.patientId,
          status: consultation.status,
        },
      },
      request
    );
  }

  return getConsultation(consultationId, user);
};

const completeConsultation = async (consultationId, user, draft, request) => {
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
        throw new AppError("Only in-progress consultations can be changed.", 409);
      }

      if (consultation.prescriptionDecision !== "none_required") {
        const issuedPrescription = await Prescription.exists({
          consultationId: consultation._id,
          doctorId: doctor._id,
          status: "issued",
        }).session(session);
        if (!issuedPrescription) {
          throw new AppError(
            "Complete the prescription decision before completing the consultation.",
            400
          );
        }
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
      if (request) {
        await recordAudit(
          {
            actorUserId: user._id,
            actorRole: user.role,
            action: "consultation.completed",
            entityType: "Consultation",
            entityId: consultation._id,
            patientId: consultation.patientId,
            description: "Consultation completed.",
            metadata: {
              patientId: consultation.patientId,
              appointmentId: appointment._id,
              status: consultation.status,
            },
          },
          request,
          session
        );
      }
    });
  } finally {
    await session.endSession();
  }
  return getConsultation(consultationId, user);
};

const cancelConsultation = async (consultationId, user, reason, request) => {
  assertObjectId(consultationId, "consultation");
  if (!["receptionist", "admin"].includes(user.role)) {
    throw new AppError("Not authorized for this action", 403);
  }
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const consultation = await Consultation.findOne({
        _id: consultationId,
        status: "in_progress",
      }).session(session);
      if (!consultation) {
        const existing = await Consultation.exists({ _id: consultationId }).session(
          session
        );
        if (!existing) throw new AppError("Consultation not found", 404);
        throw new AppError(
          "Only an in-progress consultation can be cancelled.",
          409
        );
      }
      const issuedPrescription = await Prescription.exists({
        consultationId: consultation._id,
        status: "issued",
      }).session(session);
      if (issuedPrescription) {
        throw new AppError(
          "A consultation with an issued prescription cannot be cancelled.",
          409
        );
      }

      const appointment = await Appointment.findOne({
        _id: consultation.appointmentId,
        status: "in_consultation",
      }).session(session);
      if (!appointment) {
        throw new AppError(
          "The appointment is not in consultation and cannot be returned to the queue.",
          409
        );
      }

      const queueEntry = await QueueEntry.findOne({
        appointmentId: appointment._id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        queueStatus: "in_consultation",
        active: false,
      }).session(session);
      if (!queueEntry) {
        throw new AppError("Consultation queue record was not found.", 409);
      }

      const conflictingQueueEntry = await QueueEntry.exists({
        patientId: appointment.patientId,
        active: true,
        queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
        _id: { $ne: queueEntry._id },
      }).session(session);
      if (conflictingQueueEntry) {
        throw new AppError(
          "The patient already has another active queue entry.",
          409
        );
      }

      const changedAt = new Date();
      consultation.status = "cancelled";
      consultation.cancelledAt = changedAt;
      consultation.cancelledBy = user._id;
      consultation.cancellationReason = reason;
      consultation.updatedBy = user._id;
      await consultation.save({ session });

      appointment.status = "waiting";
      appointment.statusHistory.push({
        status: "waiting",
        changedAt,
        changedBy: user._id,
        role: user.role,
        reason: "Consultation cancelled; patient returned to the waiting queue",
      });
      await appointment.save({ session });

      queueEntry.queueStatus = "waiting";
      queueEntry.active = true;
      queueEntry.calledAt = null;
      await queueEntry.save({ session });

      await recordAudit(
        {
          actorUserId: user._id,
          actorRole: user.role,
          action: "consultation.cancelled",
          entityType: "Consultation",
          entityId: consultation._id,
          patientId: consultation.patientId,
          description: "In-progress consultation cancelled and returned to queue.",
          metadata: {
            consultationId: consultation._id,
            appointmentId: appointment._id,
            actorRole: user.role,
            reason,
            appointmentStatus: appointment.status,
            queueStatus: queueEntry.queueStatus,
          },
        },
        request,
        session
      );

      result = {
        _id: consultation._id,
        appointmentId: appointment._id,
        status: consultation.status,
        appointmentStatus: appointment.status,
        queueStatus: queueEntry.queueStatus,
      };
    });
  } finally {
    await session.endSession();
  }
  return result;
};

const deleteConsultation = async (consultationId, user, reason, request) => {
  assertObjectId(consultationId, "consultation");
  if (user.role !== "admin") {
    throw new AppError("Not authorized for this action", 403);
  }
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const consultation = await Consultation.findOne({
        _id: consultationId,
      }).session(session);
      if (!consultation) throw new AppError("Consultation not found", 404);
      if (consultation.status === "completed") {
        throw new AppError(FINALIZED_HISTORY_DELETE_MESSAGE, 409);
      }
      if (!["cancelled", "in_progress"].includes(consultation.status)) {
        throw new AppError(
          "Only cancelled or eligible in-progress consultations can be deleted.",
          409
        );
      }

      const prescription = await Prescription.findOne({
        consultationId: consultation._id,
      })
        .select("_id status")
        .session(session);
      if (prescription?.status === "issued") {
        throw new AppError(FINALIZED_HISTORY_DELETE_MESSAGE, 409);
      }

      const appointment = await Appointment.findById(
        consultation.appointmentId
      ).session(session);
      if (!appointment) {
        throw new AppError(
          "This consultation cannot be deleted because its appointment record is missing.",
          409
        );
      }
      if (appointment.status === "completed") {
        throw new AppError(FINALIZED_HISTORY_DELETE_MESSAGE, 409);
      }
      const completedSibling = await Consultation.exists({
        appointmentId: appointment._id,
        status: "completed",
        _id: { $ne: consultation._id },
      }).session(session);
      if (completedSibling) {
        throw new AppError(FINALIZED_HISTORY_DELETE_MESSAGE, 409);
      }

      let queueEntry = null;
      if (consultation.status === "in_progress") {
        if (appointment.status !== "in_consultation") {
          throw new AppError(
            "This in-progress consultation is not linked to an active appointment state.",
            409
          );
        }

        queueEntry = await QueueEntry.findOne({
          appointmentId: appointment._id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          queueStatus: "in_consultation",
          active: false,
        }).session(session);
        if (!queueEntry) {
          throw new AppError(
            "This in-progress consultation has no matching queue record.",
            409
          );
        }

        const conflictingQueueEntry = await QueueEntry.exists({
          patientId: appointment.patientId,
          active: true,
          queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
          _id: { $ne: queueEntry._id },
        }).session(session);
        if (conflictingQueueEntry) {
          throw new AppError(
            "The patient already has another active queue entry.",
            409
          );
        }

        const changedAt = new Date();
        appointment.status = "waiting";
        appointment.statusHistory.push({
          status: "waiting",
          changedAt,
          changedBy: user._id,
          role: user.role,
          reason: "Erroneous consultation record deleted; patient returned to queue",
        });
        await appointment.save({ session });

        queueEntry.queueStatus = "waiting";
        queueEntry.active = true;
        queueEntry.calledAt = null;
        await queueEntry.save({ session });
      } else if (appointment.status === "in_consultation") {
        throw new AppError(
          "The appointment is still in consultation and cannot be detached from this record.",
          409
        );
      }

      if (prescription?.status === "draft") {
        await Prescription.deleteOne(
          { _id: prescription._id, status: "draft" },
          { session }
        );
      }

      await Consultation.deleteOne({ _id: consultation._id }, { session });
      await recordAudit(
        {
          actorUserId: user._id,
          actorRole: user.role,
          action: "consultation.deleted",
          entityType: "Consultation",
          entityId: consultation._id,
          patientId: consultation.patientId,
          description: "Eligible consultation record deleted by an administrator.",
          metadata: {
            consultationId: consultation._id,
            appointmentId: appointment._id,
            actorRole: user.role,
            reason,
          },
        },
        request,
        session
      );

      result = {
        _id: consultation._id,
        appointmentId: appointment._id,
        deleted: true,
        appointmentStatus: appointment.status,
        queueStatus: queueEntry?.queueStatus || null,
      };
    });
  } finally {
    await session.endSession();
  }
  return result;
};

module.exports = {
  startConsultation,
  getConsultation,
  listConsultations,
  saveDraft,
  markNoPrescriptionNeeded,
  completeConsultation,
  cancelConsultation,
  deleteConsultation,
};
