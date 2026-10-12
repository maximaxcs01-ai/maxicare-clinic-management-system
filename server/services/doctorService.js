const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const Service = require("../models/Service");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { getNextDoctorNumber } = require("./doctorNumberService");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");

const ensureServicesExist = async (serviceIds, session) => {
  const count = await Service.countDocuments({ _id: { $in: serviceIds } }).session(session || null);
  if (count !== serviceIds.length) throw new AppError("One or more selected services do not exist", 400);
};

const listDoctors = async (query, role) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { doctorNumber: pattern }, { firstName: pattern }, { middleName: pattern },
      { lastName: pattern }, { email: pattern }, { licenseNumber: pattern },
      { specialization: pattern },
    ];
  }
  if (role === "patient") filter.status = "active";
  else if (["active", "inactive"].includes(query.status)) filter.status = query.status;
  if (typeof query.specialization === "string" && query.specialization.trim()) {
    filter.specialization = new RegExp(`^${escapeRegex(query.specialization.trim())}$`, "i");
  }
  if (mongoose.isValidObjectId(query.serviceId)) filter.serviceIds = query.serviceId;

  const [data, total] = await Promise.all([
    Doctor.find(filter).populate("serviceIds", "name status").sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit),
    Doctor.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const getDoctor = async (id, role) => {
  const filter = { _id: id };
  if (role === "patient") filter.status = "active";
  return Doctor.findOne(filter).populate("serviceIds", "name status");
};

const createDoctor = async (data) => {
  const password = await bcrypt.hash(data.temporaryPassword, 10);
  const session = await mongoose.startSession();
  let createdDoctor;
  try {
    await session.withTransaction(async () => {
      await ensureServicesExist(data.serviceIds, session);
      const [user] = await User.create([{
        firstName: data.firstName, middleName: data.middleName, lastName: data.lastName,
        email: data.email, password, role: "doctor", status: data.status, emailVerified: true,
      }], { session });
      const doctorNumber = await getNextDoctorNumber(session);
      [createdDoctor] = await Doctor.create([{
        ...data, temporaryPassword: undefined, userId: user._id, doctorNumber,
      }], { session });
    });
  } finally { await session.endSession(); }
  return Doctor.findById(createdDoctor._id).populate("serviceIds", "name status");
};

const updateDoctor = async (id, data) => {
  const session = await mongoose.startSession();
  let doctorId;
  try {
    await session.withTransaction(async () => {
      await ensureServicesExist(data.serviceIds, session);
      const doctor = await Doctor.findById(id).session(session);
      if (!doctor) return;
      doctorId = doctor._id;
      const statusChanged = doctor.status !== data.status;
      Object.assign(doctor, data);
      await doctor.save({ session });
      await User.findByIdAndUpdate(doctor.userId, {
        $set: {
          firstName: data.firstName, middleName: data.middleName,
          lastName: data.lastName, email: data.email, status: data.status,
        },
        $inc: { tokenVersion: statusChanged ? 1 : 0 },
      }, { session, runValidators: true });
    });
  } finally { await session.endSession(); }
  return doctorId ? Doctor.findById(doctorId).populate("serviceIds", "name status") : null;
};

const deleteDoctor = async (id) => {
  const session = await mongoose.startSession();
  let deleted = false;
  try {
    await session.withTransaction(async () => {
      const doctor = await Doctor.findById(id).session(session);
      if (!doctor) return;
      await Doctor.deleteOne({ _id: doctor._id }, { session });
      await User.deleteOne({ _id: doctor.userId, role: "doctor" }, { session });
      deleted = true;
    });
  } finally { await session.endSession(); }
  return deleted;
};

module.exports = { listDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor };
