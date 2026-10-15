const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const DoctorSchedule = require("../models/DoctorSchedule");
const QueueEntry = require("../models/QueueEntry");
const Service = require("../models/Service");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { getNextDoctorNumber } = require("./doctorNumberService");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");
const { recordAudit } = require("./auditService");
const cloudinaryService = require("./cloudinaryService");

const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
};

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
    Doctor.find(filter)
      .populate("serviceIds", "name status")
      .populate("userId", "passwordSetupRequired status")
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(limit),
    Doctor.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const getDoctor = async (id, role) => {
  const filter = { _id: id };
  if (role === "patient") filter.status = "active";
  return Doctor.findOne(filter)
    .populate("serviceIds", "name status")
    .populate("userId", "passwordSetupRequired status");
};

const getMyDoctor = (userId) =>
  Doctor.findOne({ userId })
    .populate("serviceIds", "name status")
    .populate("userId", "passwordSetupRequired status");

const updateMyProfileImage = async (userId, file) => {
  if (!file?.buffer) {
    throw new AppError("Select a profile photo to upload", 400);
  }

  const detectedType = detectImageType(file.buffer);
  if (!detectedType || detectedType !== file.mimetype) {
    throw new AppError("Profile photo must be a valid JPEG, PNG, or WebP image", 400);
  }

  const doctor = await Doctor.findOne({ userId }).select("_id");
  if (!doctor) {
    throw new AppError("Doctor profile not found", 404);
  }

  const uploadedImage = await cloudinaryService.uploadDoctorImage(file.buffer);
  let previousDoctor;
  try {
    previousDoctor = await Doctor.findOneAndUpdate(
      { _id: doctor._id, userId },
      { $set: { profileImage: uploadedImage } },
      { new: false, runValidators: true }
    ).select("+profileImage.publicId");

    if (!previousDoctor) {
      throw new AppError("Doctor profile not found", 404);
    }
  } catch (error) {
    try {
      await cloudinaryService.deleteImage(uploadedImage.publicId);
    } catch (cleanupError) {
      console.error("Unable to clean up an unused doctor profile image");
    }
    throw error;
  }

  const previousPublicId = previousDoctor.profileImage?.publicId;
  if (previousPublicId && previousPublicId !== uploadedImage.publicId) {
    try {
      await cloudinaryService.deleteImage(previousPublicId);
    } catch (error) {
      console.error("Unable to delete the previous doctor profile image");
    }
  }

  return getMyDoctor(userId);
};

const createDoctor = async (data, actor, request) => {
  const { temporaryPassword, ...doctorData } = data;
  const password = await bcrypt.hash(temporaryPassword, 10);
  const session = await mongoose.startSession();
  let createdDoctor;
  try {
    await session.withTransaction(async () => {
      await ensureServicesExist(data.serviceIds, session);
      const [user] = await User.create([{
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        password,
        role: "doctor",
        status: data.status,
        emailVerified: true,
        passwordSetupRequired: false,
      }], { session });
      const doctorNumber = await getNextDoctorNumber(session);
      [createdDoctor] = await Doctor.create([{
        ...doctorData,
        userId: user._id,
        doctorNumber,
      }], { session });
      if (request) {
        await recordAudit(
          {
            actorUserId: actor._id,
            actorRole: actor.role,
            action: "doctor.created",
            entityType: "Doctor",
            entityId: createdDoctor._id,
            description: "Doctor account and profile created.",
            metadata: { doctorId: createdDoctor._id, userId: user._id },
          },
          request,
          session
        );
      }
    });
  } finally { await session.endSession(); }

  const doctor = await Doctor.findById(createdDoctor._id)
    .populate("serviceIds", "name status")
    .populate("userId", "passwordSetupRequired status");

  return {
    doctor,
  };
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
  return doctorId ? Doctor.findById(doctorId)
    .populate("serviceIds", "name status")
    .populate("userId", "passwordSetupRequired status") : null;
};

const deleteDoctor = async (id) => {
  const hasClinicalHistory = await Promise.all([
    Appointment.exists({ doctorId: id }),
    Consultation.exists({ doctorId: id }),
    QueueEntry.exists({ doctorId: id }),
  ]);
  if (hasClinicalHistory.some(Boolean)) {
    throw new AppError(
      "Doctors with appointment or clinical history cannot be deleted; deactivate the account instead.",
      409
    );
  }
  const session = await mongoose.startSession();
  let deleted = false;
  let profileImagePublicId = "";
  try {
    await session.withTransaction(async () => {
      const doctor = await Doctor.findById(id)
        .select("+profileImage.publicId")
        .session(session);
      if (!doctor) return;
      profileImagePublicId = doctor.profileImage?.publicId || "";
      await Doctor.deleteOne({ _id: doctor._id }, { session });
      await DoctorSchedule.deleteOne({ doctorId: doctor._id }, { session });
      await User.deleteOne({ _id: doctor.userId, role: "doctor" }, { session });
      deleted = true;
    });
  } finally { await session.endSession(); }
  if (deleted && profileImagePublicId) {
    try {
      await cloudinaryService.deleteImage(profileImagePublicId);
    } catch (error) {
      console.error("Unable to delete the removed doctor's profile image");
    }
  }
  return deleted;
};

const resendInvitation = async (id) => {
  const doctor = await Doctor.findById(id).populate("userId", "passwordSetupRequired email firstName lastName");
  if (!doctor) throw new AppError("Doctor not found", 404);

  const user = doctor.userId;
  if (!user) throw new AppError("Doctor user not found", 404);
  if (user.passwordSetupRequired !== true) {
    throw new AppError("Doctor account setup is already complete", 409);
  }

  await sendDoctorInvitation(user);
  return { message: "Account setup invitation sent successfully." };
};

module.exports = { listDoctors, getDoctor, getMyDoctor, updateMyProfileImage, createDoctor, updateDoctor, deleteDoctor, resendInvitation };
