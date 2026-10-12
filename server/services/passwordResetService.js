const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const PasswordResetRequest = require("../models/PasswordResetRequest");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const {
  getEmailConfiguration,
  sendPasswordResetEmail,
} = require("./emailService");
const {
  OTP_VALIDITY_MS,
  PENDING_VALIDITY_MS,
  RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  RESET_TOKEN_VALIDITY_MS,
  generateOtp,
  generateResetToken,
  hashResetOtp,
  verifyResetOtpHash,
  hashResetToken,
  verifyResetTokenHash,
  requireOtpSecret,
} = require("./otpService");

const buildOtpTiming = (now = Date.now()) => ({
  otpExpiresAt: new Date(now + OTP_VALIDITY_MS),
  lastOtpSentAt: new Date(now),
  expiresAt: new Date(now + PENDING_VALIDITY_MS),
});

const storeAndSendOtp = async (user) => {
  const otp = generateOtp();
  const timing = buildOtpTiming();

  const requestData = {
    userId: user._id,
    email: user.email,
    otpHash: hashResetOtp(user.email, otp),
    otpAttempts: 0,
    verified: false,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    ...timing,
  };

  let resetRequest;

  try {
    resetRequest = await PasswordResetRequest.findOneAndUpdate(
      { userId: user._id },
      { $set: requestData },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;

    resetRequest = await PasswordResetRequest.findOneAndUpdate(
      { email: user.email },
      { $set: requestData },
      { new: true, runValidators: true }
    );
  }

  try {
    await sendPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      otp,
    });
  } catch (error) {
    await PasswordResetRequest.deleteOne({ _id: resetRequest?._id });
  }
};

const requestPasswordReset = async ({ email }) => {
  getEmailConfiguration();
  requireOtpSecret();

  const user = await User.findOne({ email });
  if (!user) return;

  const existingRequest = await PasswordResetRequest.findOne({
    userId: user._id,
  });
  if (
    existingRequest &&
    Date.now() - existingRequest.lastOtpSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return;
  }

  await storeAndSendOtp(user);
};

const resendPasswordResetOtp = async ({ email }) => {
  getEmailConfiguration();
  requireOtpSecret();

  const user = await User.findOne({ email });
  if (!user) return;

  const existingRequest = await PasswordResetRequest.findOne({
    userId: user._id,
  });
  if (!existingRequest) return;

  const elapsed = Date.now() - existingRequest.lastOtpSentAt.getTime();
  if (elapsed < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS - elapsed) / 1000
    );
    throw new AppError(
      `Please wait ${remainingSeconds} seconds before requesting another code`,
      429
    );
  }

  await storeAndSendOtp(user);
};

const verifyPasswordResetOtp = async ({ email, otp }) => {
  requireOtpSecret();

  const resetRequest = await PasswordResetRequest.findOne({ email }).select(
    "+otpHash"
  );

  if (!resetRequest) {
    throw new AppError("Invalid email or verification code", 400);
  }

  if (resetRequest.otpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError("Too many verification attempts. Request a new code.", 429);
  }

  if (resetRequest.otpExpiresAt.getTime() <= Date.now()) {
    throw new AppError("Verification code has expired. Request a new code.", 400);
  }

  if (!verifyResetOtpHash(email, otp, resetRequest.otpHash)) {
    const updatedRequest = await PasswordResetRequest.findOneAndUpdate(
      { _id: resetRequest._id, otpAttempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $inc: { otpAttempts: 1 } },
      { new: true }
    );

    if (updatedRequest?.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError(
        "Too many verification attempts. Request a new code.",
        429
      );
    }

    throw new AppError("Invalid email or verification code", 400);
  }

  const resetToken = generateResetToken();
  const now = Date.now();
  const verifiedRequest = await PasswordResetRequest.findOneAndUpdate(
    {
      _id: resetRequest._id,
      otpHash: resetRequest.otpHash,
      otpExpiresAt: { $gt: new Date(now) },
      otpAttempts: { $lt: MAX_OTP_ATTEMPTS },
      verified: false,
    },
    {
      $set: {
        verified: true,
        resetTokenHash: hashResetToken(email, resetToken),
        resetTokenExpiresAt: new Date(now + RESET_TOKEN_VALIDITY_MS),
      },
    },
    { new: true }
  );

  if (!verifiedRequest) {
    throw new AppError("Invalid email or verification code", 400);
  }

  return { resetToken };
};

const resetPassword = async ({ email, resetToken, newPassword }) => {
  requireOtpSecret();

  const resetRequest = await PasswordResetRequest.findOne({ email }).select(
    "+resetTokenHash"
  );
  const now = Date.now();

  if (
    !resetRequest ||
    !resetRequest.verified ||
    !resetRequest.resetTokenHash ||
    !resetRequest.resetTokenExpiresAt ||
    resetRequest.resetTokenExpiresAt.getTime() <= now ||
    resetRequest.expiresAt.getTime() <= now ||
    !verifyResetTokenHash(email, resetToken, resetRequest.resetTokenHash)
  ) {
    throw new AppError(
      "Password reset authorization is invalid or expired",
      400
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const resetRequest = await PasswordResetRequest.findOne({ email })
        .select("+resetTokenHash")
        .session(session);
      const now = Date.now();

      if (
        !resetRequest ||
        !resetRequest.verified ||
        !resetRequest.resetTokenHash ||
        !resetRequest.resetTokenExpiresAt ||
        resetRequest.resetTokenExpiresAt.getTime() <= now ||
        resetRequest.expiresAt.getTime() <= now ||
        !verifyResetTokenHash(email, resetToken, resetRequest.resetTokenHash)
      ) {
        throw new AppError(
          "Password reset authorization is invalid or expired",
          400
        );
      }

      const user = await User.findOne({
        _id: resetRequest.userId,
        email,
      })
        .select("+tokenVersion")
        .session(session);

      if (!user) {
        throw new AppError(
          "Password reset authorization is invalid or expired",
          400
        );
      }

      user.password = passwordHash;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save({ session });

      await PasswordResetRequest.deleteOne(
        { _id: resetRequest._id },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  requestPasswordReset,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
};
