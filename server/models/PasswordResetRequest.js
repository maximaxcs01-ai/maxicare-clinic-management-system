const mongoose = require("mongoose");

const passwordResetRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    otpHash: { type: String, required: true, select: false },
    otpExpiresAt: { type: Date, required: true },
    otpAttempts: { type: Number, default: 0, min: 0 },
    lastOtpSentAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetRequestSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
  "PasswordResetRequest",
  passwordResetRequestSchema
);
