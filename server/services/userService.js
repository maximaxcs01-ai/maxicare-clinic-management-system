const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");
const { sendTemporaryPasswordEmail } = require("./emailService");
const { generateTemporaryPassword } = require("./temporaryPasswordService");

const listUsers = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ firstName: pattern }, { middleName: pattern }, { lastName: pattern }, { email: pattern }];
  }
  if (["patient", "receptionist", "doctor", "admin"].includes(query.role)) filter.role = query.role;
  if (["active", "inactive"].includes(query.status)) filter.status = query.status;
  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

const getUser = (id) => User.findById(id);

const createUser = async (data) => {
  const temporaryPassword = generateTemporaryPassword();
  const password = await bcrypt.hash(temporaryPassword, 10);
  const session = await mongoose.startSession();
  let user;
  try {
    await session.withTransaction(async () => {
      [user] = await User.create(
        [{ ...data, password, emailVerified: true, passwordSetupRequired: false, requiresPasswordChange: true }],
        { session }
      );
      await sendTemporaryPasswordEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        temporaryPassword,
      });
    });
  } finally {
    await session.endSession();
  }
  const safeUser = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete safeUser.password;
  return safeUser;
};

const reissueTemporaryPassword = async (id, currentUserId) => {
  if (String(id) === String(currentUserId)) {
    throw new AppError("You cannot reissue your own temporary password", 409);
  }
  const temporaryPassword = generateTemporaryPassword();
  const password = await bcrypt.hash(temporaryPassword, 10);
  const session = await mongoose.startSession();
  let found = false;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(id).select("+tokenVersion").session(session);
      if (!user) return;
      if (!["admin", "receptionist"].includes(user.role)) {
        throw new AppError("Temporary passwords can only be reissued for standalone staff accounts", 409);
      }
      found = true;
      user.password = password;
      user.passwordSetupRequired = false;
      user.requiresPasswordChange = true;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save({ session });
      await sendTemporaryPasswordEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        temporaryPassword,
      });
    });
  } finally {
    await session.endSession();
  }
  return found ? User.findById(id) : null;
};

const updateUser = async (id, data) => {
  const update = { ...data };
  if (update.password) update.password = await bcrypt.hash(update.password, 10);
  return User.findByIdAndUpdate(id, update, { new: true, runValidators: true });
};

const updateStatus = async (id, status, currentUserId) => {
  if (String(id) === String(currentUserId) && status === "inactive") {
    throw new AppError("You cannot deactivate your own account", 409);
  }
  const session = await mongoose.startSession();
  let found = false;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(id).select("+tokenVersion").session(session);
      if (!user) return;
      found = true;
      user.status = status;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save({ session });
      if (user.role === "doctor") {
        await Doctor.updateOne({ userId: user._id }, { status }, { session });
      }
    });
  } finally { await session.endSession(); }
  return found ? User.findById(id) : null;
};

const updateRole = async (id, role, currentUserId) => {
  if (String(id) === String(currentUserId)) throw new AppError("You cannot change your own role", 409);
  const linked = await Promise.all([Doctor.exists({ userId: id }), Patient.exists({ userId: id })]);
  if (linked.some(Boolean)) throw new AppError("Linked doctor or patient roles cannot be changed here", 409);
  return User.findByIdAndUpdate(id, { $set: { role }, $inc: { tokenVersion: 1 } }, { new: true, runValidators: true });
};

const deleteUser = async (id, currentUserId) => {
  if (String(id) === String(currentUserId)) throw new AppError("You cannot delete your own account", 409);
  const linked = await Promise.all([Doctor.exists({ userId: id }), Patient.exists({ userId: id })]);
  if (linked.some(Boolean)) throw new AppError("Linked doctor or patient accounts cannot be deleted here", 409);
  return User.findByIdAndDelete(id);
};

module.exports = { listUsers, getUser, createUser, reissueTemporaryPassword, updateUser, updateStatus, updateRole, deleteUser };
