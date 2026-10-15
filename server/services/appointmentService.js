const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Prescription = require("../models/Prescription");
const QueueEntry = require("../models/QueueEntry");
const Service = require("../models/Service");
const AppError = require("../utils/AppError");
const { getPagination, buildPagination } = require("../utils/pagination");
const {
  getDoctorAvailability,
  toManilaDateTime,
  SLOT_DURATION_MINUTES,
  getManilaDateAndMinutes,
} = require("./availabilityService");
const { recordAudit } = require("./auditService");

const SLOT_UNAVAILABLE_MESSAGE = "The selected appointment slot is no longer available.";
const TERMINAL_STATUSES = ["cancelled", "rejected", "completed", "no_show"];
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const APPOINTMENT_DELETE_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "waiting",
  "cancelled",
  "rejected",
  "no_show",
]);
const FINALIZED_APPOINTMENT_DELETE_MESSAGE =
  "This appointment cannot be deleted because it is part of finalized medical history.";

const populateAppointment = (query) =>
  query
    .populate("patientId", "patientNumber firstName middleName lastName mobileNumber")
    .populate("doctorId", "doctorNumber firstName middleName lastName specialization")
    .populate("serviceId", "name description durationMinutes fee")
    .populate("confirmedBy", "firstName lastName role")
    .populate("rejectedBy", "firstName lastName role")
    .populate("cancelledBy", "firstName lastName role")
    .populate("lastRescheduledBy", "firstName lastName role")
    .populate("triage.recordedBy", "firstName lastName role")
    .populate("statusHistory.changedBy", "firstName lastName role");

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
      rescheduleCount: 0,
      statusHistory: [
        {
          status: "pending",
          changedAt: new Date(),
          changedBy: user._id,
          role: user.role,
          reason: "Initial booking",
        },
      ],
      createdBy: user._id,
    });

    await populateAppointment(Appointment.findById(appointment._id));
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

  const completedAppointmentIds = data
    .filter((appointment) => appointment.status === "completed")
    .map((appointment) => appointment._id);
  const consultations = completedAppointmentIds.length
    ? await Consultation.find({
        patientId,
        appointmentId: { $in: completedAppointmentIds },
        status: "completed",
      }).select("appointmentId")
    : [];
  const consultationByAppointment = new Map(
    consultations.map((consultation) => [
      String(consultation.appointmentId),
      consultation._id,
    ])
  );
  const safeData = data.map((appointment) => ({
    ...(appointment.toObject ? appointment.toObject() : appointment),
    consultationId: consultationByAppointment.get(String(appointment._id)),
  }));

  return { data: safeData, pagination: buildPagination(page, limit, total) };
};

const listAllAppointments = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.status && query.status.trim()) {
    filter.status = query.status.trim();
  }

  if (query.date && query.date.trim()) {
    const dayStart = new Date(`${query.date.trim()}T00:00:00.000+08:00`);
    const dayEnd = new Date(`${query.date.trim()}T23:59:59.999+08:00`);
    filter.startAt = { $gte: dayStart, $lte: dayEnd };
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(
      query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    const [matchingPatients, matchingDoctors] = await Promise.all([
      Patient.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { patientNumber: searchRegex },
        ],
      }).select("_id"),
      Doctor.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { doctorNumber: searchRegex },
        ],
      }).select("_id"),
    ]);

    filter.$or = [
      { patientId: { $in: matchingPatients.map((p) => p._id) } },
      { doctorId: { $in: matchingDoctors.map((d) => d._id) } },
    ];
  }

  const [data, total] = await Promise.all([
    Appointment.find(filter)
      .populate("patientId", "patientNumber firstName middleName lastName mobileNumber")
      .populate("doctorId", "doctorNumber firstName middleName lastName specialization")
      .populate("serviceId", "name description durationMinutes fee")
      .populate("confirmedBy", "firstName lastName role")
      .populate("rejectedBy", "firstName lastName role")
      .populate("cancelledBy", "firstName lastName role")
      .populate("lastRescheduledBy", "firstName lastName role")
      .populate("triage.recordedBy", "firstName lastName role")
      .sort({ startAt: -1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  const appointmentIds = data.map((appointment) => appointment._id);
  const consultations = await Consultation.find({
    appointmentId: { $in: appointmentIds },
  })
    .select("_id appointmentId status")
    .lean();
  const consultationIds = consultations.map((consultation) => consultation._id);
  const patientIds = data
    .map((appointment) => appointment.patientId?._id)
    .filter(Boolean);
  const [issuedPrescriptionIds, consultationQueueEntries, activeQueueEntries] =
    await Promise.all([
      Prescription.find({
        status: "issued",
        $or: [
          { appointmentId: { $in: appointmentIds } },
          { consultationId: { $in: consultationIds } },
        ],
      })
        .select("appointmentId consultationId")
        .lean(),
      QueueEntry.find({
        appointmentId: { $in: appointmentIds },
        queueStatus: "in_consultation",
        active: false,
      })
        .select("appointmentId patientId doctorId")
        .lean(),
      QueueEntry.find({
        patientId: { $in: patientIds },
        active: true,
        queueStatus: { $in: ["waiting", "called"] },
      })
        .select("patientId")
        .lean(),
    ]);
  const issuedIds = new Set(
    issuedPrescriptionIds.map((prescription) =>
      String(prescription.consultationId)
    )
  );
  const issuedAppointmentIds = new Set(
    issuedPrescriptionIds.map((prescription) =>
      String(prescription.appointmentId)
    )
  );
  const activePatientIds = new Set(
    activeQueueEntries.map((entry) => String(entry.patientId))
  );
  const consultationByAppointment = new Map();
  const consultationPriority = { cancelled: 1, in_progress: 2, completed: 3 };
  for (const consultation of consultations) {
    const appointment = data.find(
      (entry) => String(entry._id) === String(consultation.appointmentId)
    );
    const consultationKey = String(consultation.appointmentId);
    const existing = consultationByAppointment.get(consultationKey);
    if (
      existing &&
      consultationPriority[existing.status] >=
        consultationPriority[consultation.status]
    ) {
      continue;
    }
    const matchingQueueEntry = consultationQueueEntries.some(
      (entry) =>
        String(entry.appointmentId) === String(consultation.appointmentId) &&
        String(entry.patientId) === String(appointment?.patientId?._id) &&
        String(entry.doctorId) === String(appointment?.doctorId?._id)
    );
    const hasActiveQueueEntry = activePatientIds.has(
      String(appointment?.patientId?._id)
    );
    consultationByAppointment.set(consultationKey, {
      _id: consultation._id,
      status: consultation.status,
      canDelete:
        Boolean(appointment) &&
        ["cancelled", "in_progress"].includes(consultation.status) &&
        appointment?.status !== "completed" &&
        !issuedIds.has(String(consultation._id)) &&
        (consultation.status === "in_progress"
          ? matchingQueueEntry && !hasActiveQueueEntry
          : appointment?.status !== "in_consultation"),
    });
  }
  const consultationStatusesByAppointment = new Map();
  for (const consultation of consultations) {
    const key = String(consultation.appointmentId);
    const statuses = consultationStatusesByAppointment.get(key) || [];
    statuses.push(consultation.status);
    consultationStatusesByAppointment.set(key, statuses);
  }
  return {
    data: data.map((appointment) => ({
      ...appointment.toObject(),
      consultation:
        consultationByAppointment.get(String(appointment._id)) || null,
      canDeleteAppointment:
        APPOINTMENT_DELETE_STATUSES.has(appointment.status) &&
        !issuedAppointmentIds.has(String(appointment._id)) &&
        !(consultationStatusesByAppointment.get(String(appointment._id)) || []).some(
          (status) => status !== "cancelled"
        ),
    })),
    pagination: buildPagination(page, limit, total),
  };
};

const DOCTOR_APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "waiting",
  "cancelled",
  "rejected",
];

const getManilaDayRange = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  return {
    start: new Date(`${date}T00:00:00+08:00`),
    end: new Date(`${nextDate}T00:00:00+08:00`),
  };
};

const listDoctorAppointments = async (userId, query, bucket) => {
  const doctor = await Doctor.findOne({ userId }).select("_id");
  if (!doctor) throw new AppError("Doctor profile not found", 404);

  const { page, limit, skip } = getPagination(query);
  const today = getManilaDateAndMinutes().date;
  const { start, end } = getManilaDayRange(today);
  const filter = {
    doctorId: doctor._id,
    status: { $in: DOCTOR_APPOINTMENT_STATUSES },
  };
  if (query.status) filter.status = query.status;

  if (query.date) {
    const range = getManilaDayRange(query.date);
    filter.startAt = { $gte: range.start, $lt: range.end };
  } else if (bucket === "today") {
    filter.startAt = { $gte: start, $lt: end };
  } else if (bucket === "upcoming") {
    filter.startAt = { $gte: end };
    if (!query.status) {
      filter.status = {
        $in: DOCTOR_APPOINTMENT_STATUSES.filter(
          (status) => !["cancelled", "rejected"].includes(status)
        ),
      };
    }
  } else {
    filter.$or = [
      { startAt: { $lt: start } },
      { status: { $in: ["cancelled", "rejected"] } },
    ];
  }

  const sort =
    bucket === "history" && !query.date
      ? { startAt: -1 }
      : { startAt: 1 };
  const [data, total] = await Promise.all([
    Appointment.find(filter)
      .populate("patientId", "patientNumber firstName middleName lastName")
      .populate("serviceId", "name durationMinutes")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const getAppointmentById = async (appointmentId, user) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }

  let filter = { _id: appointmentId };
  if (user.role === "patient") {
    const patient = await Patient.findOne({ userId: user._id }).select("_id");
    if (!patient) throw new AppError("Patient profile not found", 404);
    filter.patientId = patient._id;
  }

  const appointment = await populateAppointment(Appointment.findOne(filter));
  if (!appointment) throw new AppError("Appointment not found", 404);
  return appointment;
};

const confirmAppointment = async (appointmentId, user) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", 404);

  if (appointment.status !== "pending") {
    throw new AppError(
      `Cannot confirm appointment with status "${appointment.status}". Only pending appointments can be confirmed.`,
      400
    );
  }

  appointment.status = "confirmed";
  appointment.confirmedAt = new Date();
  appointment.confirmedBy = user._id;
  appointment.statusHistory.push({
    status: "confirmed",
    changedAt: new Date(),
    changedBy: user._id,
    role: user.role,
    reason: "Appointment confirmed by staff",
  });

  await appointment.save();
  return populateAppointment(Appointment.findById(appointment._id));
};

const rejectAppointment = async (appointmentId, user, { rejectionReason }) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", 404);

  if (appointment.status !== "pending") {
    throw new AppError(
      `Cannot reject appointment with status "${appointment.status}". Only pending appointments can be rejected.`,
      400
    );
  }

  const reason = (rejectionReason || "").trim();
  if (!reason) {
    throw new AppError("A rejection reason is required.", 400);
  }

  appointment.status = "rejected";
  appointment.slotReserved = false;
  appointment.rejectedAt = new Date();
  appointment.rejectedBy = user._id;
  appointment.rejectionReason = reason;
  appointment.statusHistory.push({
    status: "rejected",
    changedAt: new Date(),
    changedBy: user._id,
    role: user.role,
    reason,
  });

  await appointment.save();
  return populateAppointment(Appointment.findById(appointment._id));
};

const cancelAppointment = async (appointmentId, user, { cancellationReason }) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", 404);

  if (user.role === "patient") {
    const patient = await Patient.findOne({ userId: user._id }).select("_id");
    if (!patient || !appointment.patientId.equals(patient._id)) {
      throw new AppError("Appointment not found", 404);
    }

    const diff = appointment.startAt.getTime() - Date.now();
    if (diff < SIX_HOURS_MS) {
      throw new AppError(
        "Appointments can only be changed at least 6 hours before the scheduled time.",
        400
      );
    }
  } else {
    // Staff cancellation: require reason if inside 6-hour window
    const diff = appointment.startAt.getTime() - Date.now();
    if (diff < SIX_HOURS_MS && (!cancellationReason || !cancellationReason.trim())) {
      throw new AppError(
        "A cancellation reason is required when cancelling within 6 hours of the scheduled time.",
        400
      );
    }
  }

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    throw new AppError(
      `Cannot cancel an appointment that is already ${appointment.status}.`,
      400
    );
  }

  const reason = (cancellationReason || "").trim();
  appointment.status = "cancelled";
  appointment.slotReserved = false;
  appointment.cancelledAt = new Date();
  appointment.cancelledBy = user._id;
  appointment.cancellationReason = reason;
  appointment.statusHistory.push({
    status: "cancelled",
    changedAt: new Date(),
    changedBy: user._id,
    role: user.role,
    reason: reason || "Appointment cancelled",
  });

  await appointment.save();
  return populateAppointment(Appointment.findById(appointment._id));
};

const deleteAppointment = async (appointmentId, user, reason, request) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }
  if (user.role !== "admin") {
    throw new AppError("Not authorized for this action", 403);
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const appointment = await Appointment.findById(appointmentId).session(
        session
      );
      if (!appointment) throw new AppError("Appointment not found", 404);
      if (appointment.status === "completed") {
        throw new AppError(FINALIZED_APPOINTMENT_DELETE_MESSAGE, 409);
      }
      if (appointment.status === "in_consultation") {
        throw new AppError(
          "Cancel or delete the active consultation before deleting this appointment.",
          409
        );
      }
      if (!APPOINTMENT_DELETE_STATUSES.has(appointment.status)) {
        throw new AppError(
          "This appointment is not in a status eligible for deletion.",
          409
        );
      }

      const consultations = await Consultation.find({
        appointmentId: appointment._id,
      })
        .select("_id status")
        .session(session);
      if (consultations.some(({ status }) => status === "completed")) {
        throw new AppError(FINALIZED_APPOINTMENT_DELETE_MESSAGE, 409);
      }
      if (consultations.some(({ status }) => status === "in_progress")) {
        throw new AppError(
          "Cancel or delete the active consultation before deleting this appointment.",
          409
        );
      }
      if (consultations.some(({ status }) => status !== "cancelled")) {
        throw new AppError(
          "This appointment has a consultation that is not eligible for deletion.",
          409
        );
      }

      const consultationIds = consultations.map(({ _id }) => _id);
      const prescriptions = await Prescription.find({
        $or: [
          { appointmentId: appointment._id },
          { consultationId: { $in: consultationIds } },
        ],
      })
        .select("_id status")
        .session(session);
      if (prescriptions.some(({ status }) => status === "issued")) {
        throw new AppError(FINALIZED_APPOINTMENT_DELETE_MESSAGE, 409);
      }
      if (prescriptions.some(({ status }) => status !== "draft")) {
        throw new AppError(
          "This appointment has a prescription that is not eligible for deletion.",
          409
        );
      }

      await recordAudit(
        {
          actorUserId: user._id,
          actorRole: user.role,
          action: "appointment.deleted",
          entityType: "Appointment",
          entityId: appointment._id,
          patientId: appointment.patientId,
          description: "Eligible appointment and non-final operational records deleted.",
          metadata: {
            appointmentId: appointment._id,
            actorRole: user.role,
            reason,
            previousStatus: appointment.status,
          },
        },
        request,
        session
      );

      await QueueEntry.deleteMany({ appointmentId: appointment._id }).session(
        session
      );
      await Prescription.deleteMany({
        _id: { $in: prescriptions.map(({ _id }) => _id) },
        status: "draft",
      }).session(session);
      if (consultations.length) {
        await Consultation.deleteMany({
          _id: { $in: consultations.map(({ _id }) => _id) },
          status: "cancelled",
        }).session(session);
      }
      await Appointment.deleteOne({ _id: appointment._id }).session(session);

      result = {
        appointmentId: appointment._id,
        deleted: true,
        previousStatus: appointment.status,
        deletedQueueEntries: true,
        deletedCancelledConsultations: consultations.length,
        deletedDraftPrescriptions: prescriptions.length,
      };
    });
  } finally {
    await session.endSession();
  }
  return result;
};

const rescheduleAppointment = async (
  appointmentId,
  user,
  { date, time, reason, overrideReason },
  request
) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", 404);

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    throw new AppError(
      `Cannot reschedule an appointment that is already ${appointment.status}.`,
      400
    );
  }

  const [doctor, service] = await Promise.all([
    Doctor.findById(appointment.doctorId).select("status serviceIds"),
    Service.findById(appointment.serviceId).select("status"),
  ]);

  if (!doctor || doctor.status !== "active") {
    throw new AppError("The selected doctor is unavailable", 409);
  }
  if (!service || service.status !== "active") {
    throw new AppError("The selected service is unavailable", 409);
  }
  if (!doctor.serviceIds.some((id) => String(id) === String(appointment.serviceId))) {
    throw new AppError("The selected doctor does not support this service", 409);
  }

  const newStartAt = toManilaDateTime(date, time);
  const newEndAt = new Date(newStartAt.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
  const now = Date.now();
  const currentDiff = appointment.startAt.getTime() - now;
  const newDiff = newStartAt.getTime() - now;

  if (user.role === "patient") {
    const patient = await Patient.findOne({ userId: user._id }).select("_id");
    if (!patient || !appointment.patientId.equals(patient._id)) {
      throw new AppError("Appointment not found", 404);
    }

    if (currentDiff < SIX_HOURS_MS) {
      throw new AppError(
        "Appointments can only be changed at least 6 hours before the scheduled time.",
        400
      );
    }

    if (newDiff < SIX_HOURS_MS) {
      throw new AppError(
        "Appointments can only be changed at least 6 hours before the scheduled time.",
        400
      );
    }

    if ((appointment.rescheduleCount || 0) >= 2) {
      throw new AppError(
        "Maximum number of self-reschedules reached (2). Please contact the clinic for assistance.",
        400
      );
    }
  } else {
    // Staff role
    if (currentDiff < SIX_HOURS_MS || newDiff < SIX_HOURS_MS) {
      if (!overrideReason || !overrideReason.trim()) {
        throw new AppError(
          "An override reason is required to reschedule within 6 hours of the appointment time.",
          400
        );
      }
    }
  }

  // Validate availability of the new slot
  const availability = await getDoctorAvailability({
    doctorId: appointment.doctorId,
    date,
    serviceId: appointment.serviceId,
  });

  if (!availability.slots.some((slot) => slot.time === time && slot.available)) {
    throw new AppError(SLOT_UNAVAILABLE_MESSAGE, 409);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const conflict = await Appointment.findOne({
        _id: { $ne: appointment._id },
        doctorId: appointment.doctorId,
        startAt: newStartAt,
        slotReserved: true,
      }).session(session);

      if (conflict) {
        throw new AppError(SLOT_UNAVAILABLE_MESSAGE, 409);
      }

      const patientConflict = await Appointment.findOne({
        _id: { $ne: appointment._id },
        patientId: appointment.patientId,
        startAt: newStartAt,
        slotReserved: true,
      }).session(session);

      if (patientConflict) {
        throw new AppError(
          "You already have an appointment scheduled at this time.",
          409
        );
      }

      const target = await Appointment.findById(appointment._id).session(session);
      if (!target) throw new AppError("Appointment not found", 404);

      target.startAt = newStartAt;
      target.endAt = newEndAt;
      target.slotReserved = true;
      target.lastRescheduledAt = new Date();
      target.lastRescheduledBy = user._id;

      if (user.role === "patient") {
        target.rescheduleCount = (target.rescheduleCount || 0) + 1;
      }
      if (overrideReason && overrideReason.trim()) {
        target.overrideReason = overrideReason.trim();
      }

      const note = (overrideReason || reason || "Appointment rescheduled").trim();
      target.statusHistory.push({
        status: target.status,
        changedAt: new Date(),
        changedBy: user._id,
        role: user.role,
        reason: note,
      });

      await target.save({ session });
      if (request) {
        await recordAudit(
          {
            actorUserId: user._id,
            actorRole: user.role,
            action: "appointment.rescheduled",
            entityType: "Appointment",
            entityId: target._id,
            patientId: target.patientId,
            description: "Appointment rescheduled.",
            metadata: {
              patientId: target.patientId,
              doctorId: target.doctorId,
              serviceId: target.serviceId,
              status: target.status,
              rescheduleCount: target.rescheduleCount,
            },
          },
          request,
          session
        );
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(SLOT_UNAVAILABLE_MESSAGE, 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return populateAppointment(Appointment.findById(appointment._id));
};

const recordTriageVitals = async (appointmentId, user, vitals) => {
  if (!["admin", "receptionist"].includes(user.role)) {
    throw new AppError("Not authorized to record triage vitals.", 403);
  }
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", 404);
  if (!["checked_in", "waiting"].includes(appointment.status)) {
    throw new AppError(
      "Vitals can only be recorded after check-in and before consultation starts.",
      409
    );
  }

  const updated = Boolean(appointment.triage?.recordedAt);
  appointment.triage = {
    vitals,
    recordedBy: user._id,
    recordedAt: new Date(),
  };
  await appointment.save();

  return {
    appointment: await populateAppointment(
      Appointment.findById(appointment._id)
    ),
    updated,
  };
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
  listAllAppointments,
  listDoctorAppointments,
  getAppointmentById,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  deleteAppointment,
  rescheduleAppointment,
  recordTriageVitals,
  getPatientForUser,
};
