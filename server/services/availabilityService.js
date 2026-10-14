const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const DoctorSchedule = require("../models/DoctorSchedule");
const Service = require("../models/Service");
const Appointment = require("../models/Appointment");
const AppError = require("../utils/AppError");
const { toMinutes, validDate } = require("../validators/scheduleValidator");

const SLOT_DURATION_MINUTES = 30;
const CLINIC_TIMEZONE = "Asia/Manila";
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const getManilaNow = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CLINIC_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

const getManilaDateAndMinutes = (instant = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CLINIC_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const dateValue = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const toManilaDateTime = (date, time) => new Date(`${date}T${time}:00+08:00`);

const formatManilaTime = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

const validateHorizon = (date) => {
  if (!validDate(date)) throw new AppError("Please provide a valid date in YYYY-MM-DD format", 400);
  const now = getManilaNow();
  const difference = Math.round((dateValue(date) - dateValue(now.date)) / 86400000);
  if (difference < 0) throw new AppError("Availability is not available for past dates", 400);
  if (difference > 60) throw new AppError("Availability is limited to 60 days in advance", 400);
  return now;
};

const getBaseSchedule = (schedule, date) => {
  const override = schedule.dateOverrides.find((item) => item.date === date);
  if (override?.type === "unavailable") return [];
  if (override?.type === "custom") return override.periods;
  const day = DAY_NAMES[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  return schedule.weeklySchedule[day] || [];
};

const isOnDutyNow = (schedule, instant = new Date()) => {
  if (!schedule || schedule.status !== "active") return false;
  const { date, minutes } = getManilaDateAndMinutes(instant);
  return getBaseSchedule(schedule, date).some(
    (period) => minutes >= toMinutes(period.startTime) && minutes < toMinutes(period.endTime)
  );
};

const generateSlots = (periods) => periods.flatMap((period) => {
  const slots = [];
  const end = toMinutes(period.endTime);
  for (let time = toMinutes(period.startTime); time + SLOT_DURATION_MINUTES <= end; time += SLOT_DURATION_MINUTES) {
    slots.push(`${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`);
  }
  return slots;
});

const removePastSlots = (slots, date, now) => date === now.date ? slots.filter((time) => toMinutes(time) > now.minutes) : slots;
const removeBookedSlots = async (slots, { doctorId, date }) => {
  if (slots.length === 0) return slots;
  const slotStarts = slots.map((time) => toManilaDateTime(date, time));
  const bookedAppointments = await Appointment.find({
    doctorId,
    slotReserved: true,
    startAt: { $in: slotStarts },
  }).select("startAt").lean();
  const bookedTimes = new Set(bookedAppointments.map(({ startAt }) => formatManilaTime(startAt)));
  return slots.filter((time) => !bookedTimes.has(time));
};

const getDoctorAvailability = async ({ doctorId, date, serviceId }) => {
  if (!mongoose.isValidObjectId(doctorId)) throw new AppError("Invalid doctor", 400);
  const now = validateHorizon(date);
  const doctor = await Doctor.findById(doctorId).populate("serviceIds", "name status");
  if (!doctor) throw new AppError("Doctor not found", 404);

  if (serviceId) {
    if (!mongoose.isValidObjectId(serviceId)) throw new AppError("Invalid service", 400);
    const service = await Service.findById(serviceId);
    if (!service || service.status !== "active") throw new AppError("Service is unavailable", 400);
    if (!doctor.serviceIds.some((item) => String(item._id) === String(serviceId))) throw new AppError("Doctor does not support this service", 400);
  }

  let slots = [];
  if (doctor.status === "active") {
    const schedule = await DoctorSchedule.findOne({ doctorId });
    if (schedule?.status === "active") {
      slots = generateSlots(getBaseSchedule(schedule, date));
      slots = removePastSlots(slots, date, now);
      slots = await removeBookedSlots(slots, { doctorId, date });
    }
  }

  return {
    doctor: { id: doctor._id, name: `Dr. ${doctor.firstName} ${doctor.lastName}` },
    date, slotDurationMinutes: SLOT_DURATION_MINUTES,
    slots: slots.map((time) => ({ time, available: true })),
  };
};

module.exports = {
  SLOT_DURATION_MINUTES,
  CLINIC_TIMEZONE,
  getDoctorAvailability,
  getBaseSchedule,
  generateSlots,
  removePastSlots,
  removeBookedSlots,
  toManilaDateTime,
  getManilaDateAndMinutes,
  isOnDutyNow,
};
