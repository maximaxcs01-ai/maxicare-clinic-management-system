const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    targetType: {
      type: String,
      enum: [
        "patient_appointments",
        "patient_medical_history",
        "patient_prescriptions",
        "doctor_appointments",
        "doctor_queue",
        "staff_appointments",
        "staff_queue",
      ],
      default: undefined,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
    dedupeKey: { type: String, required: true, trim: true, maxlength: 180 },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index(
  { recipientUser: 1, dedupeKey: 1 },
  { unique: true, name: "notification_recipient_event_unique" }
);
notificationSchema.index({ recipientUser: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
