const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const Notification = require("../models/Notification");
const Patient = require("../models/Patient");
const User = require("../models/User");
const AppError = require("../utils/AppError");

const withSession = (query, session) => (session ? query.session(session) : query);

const createForUser = async ({ recipientUser, session, ...notification }) => {
  if (!recipientUser) return null;
  const recipient = await User.findById(recipientUser).select(
    "notificationPreferences.inApp"
  );
  if (!recipient || recipient.notificationPreferences?.inApp === false) {
    return null;
  }
  return Notification.findOneAndUpdate(
    { recipientUser, dedupeKey: notification.dedupeKey },
    {
      $setOnInsert: {
        recipientUser,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        targetType: notification.targetType,
        targetId: notification.targetId,
        dedupeKey: notification.dedupeKey,
        isRead: false,
      },
    },
    { upsert: true, new: true, runValidators: true, session }
  );
};

const notifyPatient = async (patientId, notification, session) => {
  const patient = await withSession(
    Patient.findById(patientId).select("userId"),
    session
  );
  if (!patient?.userId) return null;
  return createForUser({
    recipientUser: patient.userId,
    ...notification,
    session,
  });
};

const notifyDoctor = async (doctorId, notification, session) => {
  const doctor = await withSession(
    Doctor.findById(doctorId).select("userId"),
    session
  );
  if (!doctor?.userId) return null;
  return createForUser({
    recipientUser: doctor.userId,
    ...notification,
    session,
  });
};

const notifyRoles = async (roles, notification) => {
  const users = await User.find({
    role: { $in: roles },
    status: "active",
    "notificationPreferences.inApp": { $ne: false },
  }).select("_id");
  return Promise.all(
    users.map((user) =>
      createForUser({ recipientUser: user._id, ...notification })
    )
  );
};

const publishSafely = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Notification delivery failed:", error.message);
    }
    return null;
  }
};

const listMine = async (userId, requestedLimit) => {
  const limit = Math.min(Math.max(Number(requestedLimit) || 15, 1), 50);
  const [data, unreadCount] = await Promise.all([
    Notification.find({ recipientUser: userId })
      .select("type title message targetType targetId isRead readAt createdAt")
      .sort({ createdAt: -1 })
      .limit(limit),
    Notification.countDocuments({ recipientUser: userId, isRead: false }),
  ]);
  return { data, unreadCount };
};

const getUnreadCount = (userId) =>
  Notification.countDocuments({ recipientUser: userId, isRead: false });

const markOneRead = async (notificationId, userId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw new AppError("Invalid notification", 400);
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientUser: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  ).select("type title message targetType targetId isRead readAt createdAt");
  if (!notification) throw new AppError("Notification not found", 404);
  return notification;
};

const markAllRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipientUser: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { updatedCount: result.modifiedCount || 0 };
};

module.exports = {
  createForUser,
  notifyPatient,
  notifyDoctor,
  notifyRoles,
  publishSafely,
  listMine,
  getUnreadCount,
  markOneRead,
  markAllRead,
};
