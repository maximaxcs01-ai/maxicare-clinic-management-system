const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AppError = require("../utils/AppError");

const getAccountSettings = async (userId) => {
  const user = await User.findById(userId).select(
    "email role status termsVersion termsAcceptedAt privacyAcceptedAt notificationPreferences.inApp"
  );
  if (!user) throw new AppError("Account not found.", 404);

  return {
    email: user.email,
    role: user.role,
    status: user.status,
    notificationPreferences: {
      inApp: user.notificationPreferences?.inApp !== false,
    },
    termsVersion: user.termsVersion || null,
    termsAcceptedAt: user.termsAcceptedAt || null,
    privacyAcceptedAt: user.privacyAcceptedAt || null,
  };
};

const updateNotificationPreference = async (userId, inApp) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { "notificationPreferences.inApp": inApp } },
    { new: true, runValidators: true }
  ).select("notificationPreferences.inApp");

  if (!user) throw new AppError("Account not found.", 404);
  return { inApp: user.notificationPreferences?.inApp !== false };
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select("+password +tokenVersion");
  if (!user) throw new AppError("Account not found.", 404);

  const currentPasswordMatches = await bcrypt.compare(
    currentPassword,
    user.password
  );
  if (!currentPasswordMatches) {
    throw new AppError("Current password is incorrect.", 400);
  }

  if (await bcrypt.compare(newPassword, user.password)) {
    throw new AppError("New password must be different from your current password.", 400);
  }

  const password = await bcrypt.hash(newPassword, 10);
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, password: user.password },
    {
      $set: { password },
      $inc: { tokenVersion: 1 },
    },
    { new: true, runValidators: true }
  ).select("+tokenVersion");

  if (!updatedUser) {
    throw new AppError("Unable to change password. Please try again.", 409);
  }

  return updatedUser;
};

const signOutAllDevices = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { new: true, runValidators: true }
  ).select("+tokenVersion");
  if (!user) throw new AppError("Account not found.", 404);
};

module.exports = {
  getAccountSettings,
  updateNotificationPreference,
  changePassword,
  signOutAllDevices,
};
