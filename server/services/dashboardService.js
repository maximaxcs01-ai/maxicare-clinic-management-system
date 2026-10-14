const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Prescription = require("../models/Prescription");
const QueueEntry = require("../models/QueueEntry");
const Service = require("../models/Service");
const AppError = require("../utils/AppError");
const { getManilaDayRange, getManilaDate } = require("../utils/manilaDateRange");

const appointmentStatuses = [
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

const countByAppointmentStatus = async (filter) => {
  const groups = await Appointment.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(
    appointmentStatuses.map((status) => [
      status,
      groups.find((group) => group._id === status)?.count || 0,
    ])
  );
};

const patientDashboard = async (user) => {
  const patient = await Patient.findOne({ userId: user._id }).select("_id");
  if (!patient) throw new AppError("Patient profile not found", 404);
  const now = new Date();
  const { start, end } = getManilaDayRange(getManilaDate(now));
  const upcomingStatuses = ["pending", "confirmed", "checked_in"];
  const [nextAppointment, upcomingCount, recentConsultations, prescriptionCount] =
    await Promise.all([
      Appointment.findOne({
        patientId: patient._id,
        status: { $in: upcomingStatuses },
        startAt: { $gte: now },
      })
        .sort({ startAt: 1 })
        .select("startAt endAt status bookingType")
        .populate("doctorId", "firstName lastName")
        .populate("serviceId", "name"),
      Appointment.countDocuments({
        patientId: patient._id,
        status: { $in: upcomingStatuses },
        startAt: { $gte: now },
      }),
      Consultation.find({
        patientId: patient._id,
        status: "completed",
      })
        .select("completedAt diagnosis treatmentPlan instructions serviceId")
        .sort({ completedAt: -1 })
        .limit(5)
        .populate("serviceId", "name"),
      Prescription.countDocuments({
        patientId: patient._id,
        status: "issued",
      }),
    ]);
  return {
    nextAppointment,
    upcomingCount,
    recentConsultations,
    issuedPrescriptionCount: prescriptionCount,
    todayRange: { start, end },
  };
};

const receptionistDashboard = async () => {
  const { start, end } = getManilaDayRange(getManilaDate());
  const todayAppointments = { startAt: { $gte: start, $lt: end } };
  const [
    totalAppointments,
    statusCounts,
    walkInsToday,
    activeQueueCount,
  ] = await Promise.all([
    Appointment.countDocuments(todayAppointments),
    countByAppointmentStatus(todayAppointments),
    Appointment.countDocuments({
      ...todayAppointments,
      bookingType: "walk_in",
    }),
    QueueEntry.countDocuments({ active: true }),
  ]);
  return {
    today: { appointments: totalAppointments, statusCounts },
    walkInsToday,
    activeQueueCount,
  };
};

const doctorDashboard = async (user) => {
  const doctor = await Doctor.findOne({ userId: user._id }).select("_id");
  if (!doctor) throw new AppError("Doctor profile not found", 404);
  const now = new Date();
  const { start, end } = getManilaDayRange(getManilaDate(now));
  const [todayAppointments, queueCount, activeConsultation, completedToday, upcomingCount, upcomingAppointments] =
    await Promise.all([
      Appointment.countDocuments({
        doctorId: doctor._id,
        startAt: { $gte: start, $lt: end },
      }),
      QueueEntry.countDocuments({
        doctorId: doctor._id,
        active: true,
        queueStatus: { $in: ["waiting", "called"] },
      }),
      Consultation.findOne({
        doctorId: doctor._id,
        status: "in_progress",
      })
        .select("startedAt patientId serviceId")
        .populate("patientId", "patientNumber firstName lastName")
        .populate("serviceId", "name"),
      Consultation.countDocuments({
        doctorId: doctor._id,
        status: "completed",
        completedAt: { $gte: start, $lt: end },
      }),
      Appointment.countDocuments({
        doctorId: doctor._id,
        startAt: { $gte: now },
        status: { $in: ["pending", "confirmed"] },
      }),
      Appointment.find({
        doctorId: doctor._id,
        startAt: { $gte: now },
        status: { $in: ["pending", "confirmed"] },
      })
        .select("startAt status")
        .sort({ startAt: 1 })
        .limit(5)
        .populate("patientId", "patientNumber firstName lastName")
        .populate("serviceId", "name"),
    ]);
  return {
    todayAppointments,
    waitingCalledQueueCount: queueCount,
    activeConsultation,
    completedConsultationsToday: completedToday,
    upcomingCount,
    upcomingAppointments,
  };
};

const adminDashboard = async () => {
  const { start, end } = getManilaDayRange(getManilaDate());
  const todayAppointments = { startAt: { $gte: start, $lt: end } };
  const [
    totalPatients,
    activeDoctors,
    activeServices,
    todayAppointmentCount,
    walkInsToday,
    activeQueue,
    completedConsultationsToday,
    statusCounts,
  ] = await Promise.all([
    Patient.countDocuments(),
    Doctor.countDocuments({ status: "active" }),
    Service.countDocuments({ status: "active" }),
    Appointment.countDocuments(todayAppointments),
    Appointment.countDocuments({ ...todayAppointments, bookingType: "walk_in" }),
    QueueEntry.countDocuments({ active: true }),
    Consultation.countDocuments({
      status: "completed",
      completedAt: { $gte: start, $lt: end },
    }),
    countByAppointmentStatus(todayAppointments),
  ]);
  return {
    totalPatients,
    activeDoctors,
    activeServices,
    todayAppointments: todayAppointmentCount,
    walkInsToday,
    activeQueue,
    completedConsultationsToday,
    appointmentStatusSummary: statusCounts,
  };
};

const getDashboard = async (user) => {
  if (user.role === "patient") return patientDashboard(user);
  if (user.role === "receptionist") return receptionistDashboard();
  if (user.role === "doctor") return doctorDashboard(user);
  if (user.role === "admin") return adminDashboard();
  throw new AppError("Not authorized for this action", 403);
};

module.exports = {
  getDashboard,
  countByAppointmentStatus,
  patientDashboard,
  receptionistDashboard,
  doctorDashboard,
  adminDashboard,
};
