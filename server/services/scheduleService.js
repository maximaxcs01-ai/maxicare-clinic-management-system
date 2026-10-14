const Doctor = require("../models/Doctor");
const DoctorSchedule = require("../models/DoctorSchedule");
const AppError = require("../utils/AppError");

const assertDoctorAccess = async (doctorId, user, write = false) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new AppError("Doctor not found", 404);
  if (user.role === "doctor" && String(doctor.userId) !== String(user._id)) throw new AppError("Not authorized for this doctor schedule", 403);
  if (write && !["admin", "doctor"].includes(user.role)) throw new AppError("Not authorized for this action", 403);
  if (write && user.role === "doctor" && doctor.status !== "active") throw new AppError("Inactive doctors cannot update schedules", 409);
  return doctor;
};

const emptySchedule = (doctorId) => ({
  doctorId,
  weeklySchedule: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
  dateOverrides: [], timezone: "Asia/Manila", status: "active",
});

const getSchedule = async (doctorId, user) => {
  const doctor = await assertDoctorAccess(doctorId, user);
  const schedule = await DoctorSchedule.findOne({ doctorId });
  return { doctor, schedule: schedule || emptySchedule(doctorId) };
};

const saveSchedule = async (doctorId, data, user) => {
  const doctor = await assertDoctorAccess(doctorId, user, true);
  const schedule = await DoctorSchedule.findOneAndUpdate(
    { doctorId }, { $set: data }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return { doctor, schedule };
};

module.exports = { getSchedule, saveSchedule };
