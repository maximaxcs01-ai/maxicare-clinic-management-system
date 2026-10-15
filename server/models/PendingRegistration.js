const mongoose = require("mongoose");

const pendingRegistrationSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: "" },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNumber: { type: String, required: true, trim: true },
    termsAcceptedAt: { type: Date },
    privacyAcceptedAt: { type: Date },
    termsVersion: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    otpHash: { type: String, required: true, select: false },
    otpExpiresAt: { type: Date, required: true },
    otpAttempts: { type: Number, default: 0, min: 0 },
    lastOtpSentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema
);
