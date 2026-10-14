const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const DoctorSchedule = require("../models/DoctorSchedule");
const Patient = require("../models/Patient");
const QueueEntry = require("../models/QueueEntry");
const Service = require("../models/Service");
const AppError = require("../utils/AppError");
const AuditLog = require("../models/AuditLog");
const { recordAudit } = require("./auditService");
const patientService = require("./patientService");
const {
  CLINIC_TIMEZONE,
  getManilaDateAndMinutes,
  getBaseSchedule,
  isOnDutyNow,
} = require("./availabilityService");

const ACTIVE_QUEUE_STATUSES = ["waiting", "called"];
const DUPLICATE_QUEUE_MESSAGE =
  "This patient already has an active queue entry.";
const NO_ON_DUTY_DOCTOR_MESSAGE =
  "No available on-duty doctor currently supports this service.";
const STALE_QUEUE_EXPIRATION_REASON =
  "System: queue entry expired after its clinic day ended.";
const QUEUE_DUPLICATE_INDEXES = [
  "active_queue_patient_unique",
  "active_queue_appointment_unique",
];

const isQueueDuplicateError = (error) =>
  error.code === 11000 &&
  QUEUE_DUPLICATE_INDEXES.some((indexName) =>
    error.message.includes(indexName)
  );

const getManilaDayBounds = (instant = new Date()) => {
  const date = getManilaDateAndMinutes(instant).date;
  const [year, month, day] = date.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  return {
    start: new Date(`${date}T00:00:00+08:00`),
    end: new Date(`${nextDay}T00:00:00+08:00`),
    date,
  };
};

const queuePopulation = (query) =>
  query
    .populate("patientId", "patientNumber firstName middleName lastName mobileNumber email")
    .populate("doctorId", "doctorNumber firstName middleName lastName specialization")
    .populate("serviceId", "name description durationMinutes fee")
    .populate("appointmentId", "bookingType status startAt endAt");

const appointmentPopulation = (query) =>
  query
    .populate("patientId", "patientNumber firstName middleName lastName mobileNumber email")
    .populate("doctorId", "doctorNumber firstName middleName lastName specialization")
    .populate("serviceId", "name description durationMinutes fee")
    .populate("statusHistory.changedBy", "firstName lastName role");

const getEligibleDoctors = async (serviceId, session) => {
  const serviceQuery = Service.findById(serviceId).select(
    "name description durationMinutes fee status"
  );
  if (session) serviceQuery.session(session);
  const service = await serviceQuery;
  if (!service || service.status !== "active") {
    throw new AppError("The selected service is unavailable", 409);
  }

  const doctorsQuery = Doctor.find({
    status: "active",
    serviceIds: serviceId,
  })
    .select("_id doctorNumber firstName middleName lastName specialization")
    .sort({ doctorNumber: 1, _id: 1 });
  if (session) doctorsQuery.session(session);
  const doctors = await doctorsQuery;
  if (!doctors.length) throw new AppError(NO_ON_DUTY_DOCTOR_MESSAGE, 409);

  const scheduleQuery = DoctorSchedule.find({
    doctorId: { $in: doctors.map((doctor) => doctor._id) },
    status: "active",
  });
  if (session) scheduleQuery.session(session);
  const schedules = await scheduleQuery;
  const scheduleByDoctor = new Map(
    schedules.map((schedule) => [String(schedule.doctorId), schedule])
  );
  const onDutyDoctors = doctors.filter((doctor) =>
    isOnDutyNow(scheduleByDoctor.get(String(doctor._id)))
  );
  if (!onDutyDoctors.length) throw new AppError(NO_ON_DUTY_DOCTOR_MESSAGE, 409);

  return { service, onDutyDoctors };
};

const getTodayQueueCounts = async (doctorIds, session) => {
  const { start, end } = getManilaDayBounds();
  const aggregate = QueueEntry.aggregate([
    {
      $match: {
        doctorId: { $in: doctorIds },
        active: true,
        queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
        joinedAt: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: "$doctorId", count: { $sum: 1 } } },
  ]);
  if (session) aggregate.session(session);
  const counts = await aggregate;
  return new Map(counts.map(({ _id, count }) => [String(_id), count]));
};

const expireStaleQueueEntriesBeforeEnqueue = async (session) => {
  const { start } = getManilaDayBounds();
  const staleQuery = QueueEntry.find({
    active: true,
    queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
    joinedAt: { $lt: start },
  });
  if (session) staleQuery.session(session);
  const staleEntries = await staleQuery.select("_id patientId");
  const update = QueueEntry.updateMany(
    {
      active: true,
      queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
      joinedAt: { $lt: start },
    },
    {
      $set: {
        active: false,
        queueStatus: "expired",
        expiredAt: new Date(),
        expirationReason: STALE_QUEUE_EXPIRATION_REASON,
      },
    }
  );
  if (session) update.session(session);
  await update;
  if (staleEntries.length) {
    await AuditLog.insertMany(
      staleEntries.map((entry) => ({
        actorRole: "system",
        action: "queue.expired",
        entityType: "QueueEntry",
        entityId: entry._id,
        patientId: entry.patientId,
        description: "Stale queue entry expired after its clinic day ended.",
        metadata: { patientId: entry.patientId, status: "expired" },
      })),
      { session }
    );
  }
};

const selectNextDoctor = async (serviceId, session) => {
  const { service, onDutyDoctors } = await getEligibleDoctors(serviceId, session);
  const counts = await getTodayQueueCounts(
    onDutyDoctors.map((doctor) => doctor._id),
    session
  );

  const selected = onDutyDoctors
    .map((doctor) => ({
      doctor,
      queueLength: counts.get(String(doctor._id)) || 0,
    }))
    .sort(
      (left, right) =>
        left.queueLength - right.queueLength ||
        left.doctor.doctorNumber.localeCompare(right.doctor.doctorNumber) ||
        String(left.doctor._id).localeCompare(String(right.doctor._id))
    )[0];
  return { service, ...selected };
};

const getNextDoctorForService = async (serviceId) => {
  if (!mongoose.isValidObjectId(serviceId)) {
    throw new AppError("Select a valid service", 400);
  }
  const { doctor, queueLength } = await selectNextDoctor(serviceId);
  return {
    doctor: {
      _id: doctor._id,
      doctorNumber: doctor.doctorNumber,
      firstName: doctor.firstName,
      middleName: doctor.middleName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
    },
    activeQueueCount: queueLength,
    timezone: CLINIC_TIMEZONE,
  };
};

const assertNoActiveQueueEntry = async (patientId, session) => {
  const existingQuery = QueueEntry.exists({
    patientId,
    active: true,
    queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
  });
  if (session) existingQuery.session(session);
  if (await existingQuery) throw new AppError(DUPLICATE_QUEUE_MESSAGE, 409);
};

const appendAppointmentStatus = (appointment, status, user, reason) => {
  appointment.status = status;
  appointment.statusHistory.push({
    status,
    changedAt: new Date(),
    changedBy: user._id,
    role: user.role,
    reason,
  });
};

const getQueuePosition = async (queueEntry) => {
  const { start, end } = getManilaDayBounds(queueEntry.joinedAt);
  const doctorId = queueEntry.doctorId?._id || queueEntry.doctorId;
  const entries = await QueueEntry.find({
    doctorId,
    active: true,
    queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
    joinedAt: { $gte: start, $lt: end },
  })
    .sort({ joinedAt: 1, _id: 1 })
    .select("_id")
    .lean();
  return entries.findIndex((entry) => String(entry._id) === String(queueEntry._id)) + 1;
};

const createWalkIn = async (input, user, request) => {
  const session = await mongoose.startSession();
  let appointmentId;
  let queueEntryId;
  let assignedDoctorId;

  try {
    await session.withTransaction(async () => {
      await expireStaleQueueEntriesBeforeEnqueue(session);
      let patient;
      if (input.patientId) {
        patient = await Patient.findById(input.patientId).session(session);
        if (!patient) throw new AppError("Patient not found", 404);
      } else {
        patient = await patientService.createPatient(input.newPatient, session);
      }

      await assertNoActiveQueueEntry(patient._id, session);
      const { service, doctor } = await selectNextDoctor(input.serviceId, session);
      const arrivalAt = new Date();
      const [appointment] = await Appointment.create(
        [
          {
            patientId: patient._id,
            doctorId: doctor._id,
            serviceId: service._id,
            startAt: arrivalAt,
            endAt: new Date(arrivalAt.getTime() + service.durationMinutes * 60 * 1000),
            status: "checked_in",
            bookingType: "walk_in",
            slotReserved: false,
            checkedInAt: arrivalAt,
            checkedInBy: user._id,
            createdBy: user._id,
            statusHistory: [
              {
                status: "checked_in",
                changedAt: arrivalAt,
                changedBy: user._id,
                role: user.role,
                reason: "Walk-in arrival",
              },
            ],
          },
        ],
        { session }
      );
      const [queueEntry] = await QueueEntry.create(
        [
          {
            appointmentId: appointment._id,
            patientId: patient._id,
            doctorId: doctor._id,
            serviceId: service._id,
            queueStatus: "waiting",
            active: true,
            joinedAt: arrivalAt,
            createdBy: user._id,
          },
        ],
        { session }
      );
      appendAppointmentStatus(
        appointment,
        "waiting",
        user,
        "Walk-in added to the queue"
      );
      await appointment.save({ session });
      if (request) {
        await recordAudit(
          {
            actorUserId: user._id,
            actorRole: user.role,
            action: "walk_in.created",
            entityType: "QueueEntry",
            entityId: queueEntry._id,
            patientId: patient._id,
            description: "Walk-in visit added to the queue.",
            metadata: {
              patientId: patient._id,
              doctorId: doctor._id,
              serviceId: service._id,
              status: queueEntry.queueStatus,
              bookingType: "walk_in",
            },
          },
          request,
          session
        );
        await recordAudit(
          {
            actorUserId: user._id,
            actorRole: user.role,
            action: "queue.entry_created",
            entityType: "QueueEntry",
            entityId: queueEntry._id,
            patientId: patient._id,
            description: "Walk-in added to the queue.",
            metadata: {
              patientId: patient._id,
              appointmentId: appointment._id,
              status: queueEntry.queueStatus,
            },
          },
          request,
          session
        );
      }

      appointmentId = appointment._id;
      queueEntryId = queueEntry._id;
      assignedDoctorId = doctor._id;
    });
  } catch (error) {
    if (isQueueDuplicateError(error)) {
      throw new AppError(DUPLICATE_QUEUE_MESSAGE, 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const queueEntry = await queuePopulation(QueueEntry.findById(queueEntryId));
  return {
    appointment: await appointmentPopulation(
      Appointment.findById(appointmentId)
    ),
    queueEntry,
    queuePosition: await getQueuePosition({
      _id: queueEntryId,
      doctorId: assignedDoctorId,
      joinedAt: queueEntry.joinedAt,
    }),
  };
};

const checkInScheduledAppointment = async (appointmentId, user, request) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const appointment = await Appointment.findById(appointmentId).session(session);
      if (!appointment) throw new AppError("Appointment not found", 404);
      if (appointment.bookingType !== "scheduled" || appointment.status !== "confirmed") {
        throw new AppError("Only confirmed scheduled appointments can be checked in.", 409);
      }
      if (
        getManilaDateAndMinutes(appointment.startAt).date !==
        getManilaDateAndMinutes().date
      ) {
        throw new AppError("Appointments can only be checked in on their scheduled date.", 409);
      }
      const checkedInAt = new Date();
      appointment.checkedInAt = checkedInAt;
      appointment.checkedInBy = user._id;
      appendAppointmentStatus(
        appointment,
        "checked_in",
        user,
        "Patient checked in at the clinic"
      );
      await appointment.save({ session });
      if (request) {
        await recordAudit(
          {
            actorUserId: user._id,
            actorRole: user.role,
            action: "appointment.checked_in",
            entityType: "Appointment",
            entityId: appointment._id,
            patientId: appointment.patientId,
            description: "Appointment checked in.",
            metadata: { patientId: appointment.patientId, status: appointment.status },
          },
          request,
          session
        );
      }
    });
  } finally {
    await session.endSession();
  }
  return appointmentPopulation(Appointment.findById(appointmentId));
};

const addCheckedInAppointmentToQueue = async (appointmentId, user, request) => {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new AppError("Invalid appointment", 400);
  }
  const session = await mongoose.startSession();
  let queueEntryId;
  try {
    await session.withTransaction(async () => {
      await expireStaleQueueEntriesBeforeEnqueue(session);
      const appointment = await Appointment.findById(appointmentId).session(session);
      if (!appointment) throw new AppError("Appointment not found", 404);
      if (
        appointment.bookingType !== "scheduled" ||
        appointment.status !== "checked_in"
      ) {
        throw new AppError("Only checked-in scheduled appointments can join the queue.", 409);
      }
      await assertNoActiveQueueEntry(appointment.patientId, session);

      const [queueEntry] = await QueueEntry.create(
        [
          {
            appointmentId: appointment._id,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            serviceId: appointment.serviceId,
            queueStatus: "waiting",
            active: true,
            joinedAt: new Date(),
            createdBy: user._id,
          },
        ],
        { session }
      );
      appendAppointmentStatus(
        appointment,
        "waiting",
        user,
        "Checked-in patient added to the queue"
      );
      await appointment.save({ session });
      if (request) {
        await recordAudit(
          {
            actorUserId: user._id,
            actorRole: user.role,
            action: "queue.entry_created",
            entityType: "QueueEntry",
            entityId: queueEntry._id,
            patientId: appointment.patientId,
            description: "Checked-in appointment added to the queue.",
            metadata: {
              appointmentId: appointment._id,
              patientId: appointment.patientId,
              status: queueEntry.queueStatus,
            },
          },
          request,
          session
        );
      }
      queueEntryId = queueEntry._id;
    });
  } catch (error) {
    if (isQueueDuplicateError(error)) {
      throw new AppError(DUPLICATE_QUEUE_MESSAGE, 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
  const queueEntry = await queuePopulation(QueueEntry.findById(queueEntryId));
  return {
    queueEntry,
    queuePosition: await getQueuePosition(queueEntry),
  };
};

const listTodayQueue = async (user) => {
  const { start, end, date } = getManilaDayBounds();
  let doctorFilter = {};
  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({ userId: user._id }).select("_id");
    if (!doctor) throw new AppError("Doctor profile not found", 404);
    doctorFilter = { doctorId: doctor._id };
  }

  const entries = await queuePopulation(
    QueueEntry.find({
      ...doctorFilter,
      active: true,
      queueStatus: { $in: ACTIVE_QUEUE_STATUSES },
      joinedAt: { $gte: start, $lt: end },
    }).sort({ doctorId: 1, joinedAt: 1, _id: 1 })
  );
  const positions = new Map();
  const data = entries.map((entry) => {
    const groupId = String(entry.doctorId?._id || "unknown");
    const position = (positions.get(groupId) || 0) + 1;
    positions.set(groupId, position);
    return { ...entry.toObject(), queuePosition: position };
  });
  return { date, timezone: CLINIC_TIMEZONE, data };
};

const callNextForDoctor = async (doctorId) => {
  if (!mongoose.isValidObjectId(doctorId)) {
    throw new AppError("Invalid doctor", 400);
  }
  const doctor = await Doctor.findOne({ _id: doctorId, status: "active" }).select("_id");
  if (!doctor) throw new AppError("Active doctor not found", 404);
  const { start, end } = getManilaDayBounds();
  const entry = await QueueEntry.findOneAndUpdate(
    {
      doctorId,
      active: true,
      queueStatus: "waiting",
      joinedAt: { $gte: start, $lt: end },
    },
    { $set: { queueStatus: "called", calledAt: new Date() } },
    { new: true, sort: { joinedAt: 1, _id: 1 } }
  );
  if (!entry) throw new AppError("There are no waiting patients for this doctor.", 404);
  return queuePopulation(QueueEntry.findById(entry._id));
};

const returnQueueEntryToWaiting = async (queueEntryId) => {
  if (!mongoose.isValidObjectId(queueEntryId)) {
    throw new AppError("Invalid queue entry", 400);
  }
  const entry = await QueueEntry.findOneAndUpdate(
    { _id: queueEntryId, active: true, queueStatus: "called" },
    { $set: { queueStatus: "waiting", calledAt: null } },
    { new: true }
  );
  if (!entry) throw new AppError("Called queue entry not found", 404);
  return queuePopulation(QueueEntry.findById(entry._id));
};

const removeQueueEntry = async (queueEntryId, reason) => {
  if (!mongoose.isValidObjectId(queueEntryId)) {
    throw new AppError("Invalid queue entry", 400);
  }
  const entry = await QueueEntry.findOneAndUpdate(
    { _id: queueEntryId, active: true, queueStatus: { $in: ACTIVE_QUEUE_STATUSES } },
    {
      $set: {
        queueStatus: "removed",
        active: false,
        removedAt: new Date(),
        removalReason: reason,
      },
    },
    { new: true }
  );
  if (!entry) throw new AppError("Active queue entry not found", 404);
  return queuePopulation(QueueEntry.findById(entry._id));
};

module.exports = {
  getManilaDayBounds,
  getNextDoctorForService,
  createWalkIn,
  checkInScheduledAppointment,
  addCheckedInAppointmentToQueue,
  listTodayQueue,
  callNextForDoctor,
  returnQueueEntryToWaiting,
  removeQueueEntry,
  isOnDutyNow,
  getBaseSchedule,
  selectNextDoctor,
};
