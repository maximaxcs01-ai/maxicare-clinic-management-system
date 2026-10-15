const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const PendingRegistration = require("../models/PendingRegistration");
const Patient = require("../models/Patient");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { sendVerificationEmail, getEmailConfiguration } = require("./emailService");
const { getNextPatientNumber } = require("./patientNumberService");
const {
  OTP_VALIDITY_MS,
  PENDING_VALIDITY_MS,
  RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  generateOtp,
  hashOtp,
  verifyOtpHash,
  requireOtpSecret,
} = require("./otpService");

const buildOtpTiming = (now = Date.now()) => ({
  otpExpiresAt: new Date(now + OTP_VALIDITY_MS),
  lastOtpSentAt: new Date(now),
  expiresAt: new Date(now + PENDING_VALIDITY_MS),
});

const registerPendingPatient = async (registration) => {
  getEmailConfiguration();
  requireOtpSecret();

  const existingUser = await User.exists({ email: registration.email });
  if (existingUser) {
    throw new AppError("Email is already registered", 409);
  }

  const otp = generateOtp();
  const passwordHash = await bcrypt.hash(registration.password, 10);
  const timing = buildOtpTiming();

  const pendingData = {
    firstName: registration.firstName,
    middleName: registration.middleName,
    lastName: registration.lastName,
    email: registration.email,
    mobileNumber: registration.mobileNumber,
    passwordHash,
    otpHash: hashOtp(registration.email, otp),
    otpAttempts: 0,
    ...timing,
  };

  try {
    await PendingRegistration.findOneAndUpdate(
      { email: registration.email },
      { $set: pendingData },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;

    await PendingRegistration.findOneAndUpdate(
      { email: registration.email },
      { $set: pendingData },
      { new: true, runValidators: true }
    );
  }

  const userCreatedDuringRegistration = await User.exists({
    email: registration.email,
  });
  if (userCreatedDuringRegistration) {
    await PendingRegistration.deleteOne({ email: registration.email });
    throw new AppError("Email is already registered", 409);
  }

  await sendVerificationEmail({
    email: registration.email,
    firstName: registration.firstName,
    otp,
  });

  return { email: registration.email };
};

const verifyPendingPatient = async ({ email, otp }) => {
  requireOtpSecret();

  const pending = await PendingRegistration.findOne({ email }).select(
    "+otpHash +passwordHash"
  );
  if (!pending) {
    throw new AppError("Registration session not found or expired", 400);
  }

  if (pending.otpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError("Too many verification attempts. Request a new code.", 429);
  }

  if (pending.otpExpiresAt.getTime() <= Date.now()) {
    throw new AppError("Verification code has expired. Request a new code.", 400);
  }

  if (!verifyOtpHash(email, otp, pending.otpHash)) {
    const updatedPending = await PendingRegistration.findOneAndUpdate(
      { _id: pending._id, otpAttempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $inc: { otpAttempts: 1 } },
      { new: true }
    );

    if (updatedPending?.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError(
        "Too many verification attempts. Request a new code.",
        429
      );
    }

    throw new AppError("Invalid email or verification code", 400);
  }

  const session = await mongoose.startSession();

  let verifiedUser;

  try {
    await session.withTransaction(async () => {
      const currentPending = await PendingRegistration.findById(
        pending._id
      )
        .select("+otpHash +passwordHash")
        .session(session);

      if (
        !currentPending ||
        currentPending.otpExpiresAt.getTime() <= Date.now() ||
        currentPending.otpAttempts >= MAX_OTP_ATTEMPTS ||
        !verifyOtpHash(email, otp, currentPending.otpHash)
      ) {
        throw new AppError("Registration session is no longer valid", 400);
      }

      const existingUser = await User.findOne({ email }).session(session);
      if (existingUser) {
        throw new AppError("Email is already registered", 409);
      }

      const [user] = await User.create(
        [
          {
            firstName: currentPending.firstName,
            middleName: currentPending.middleName,
            lastName: currentPending.lastName,
            email: currentPending.email,
            password: currentPending.passwordHash,
            role: "patient",
            status: "active",
            emailVerified: true,
          },
        ],
        { session }
      );
      verifiedUser = user;

      const patientNumber = await getNextPatientNumber(session);

      await Patient.create(
        [
          {
            userId: user._id,
            patientNumber,
            firstName: currentPending.firstName,
            middleName: currentPending.middleName,
            lastName: currentPending.lastName,
            email: currentPending.email,
            mobileNumber: currentPending.mobileNumber,
            contactNumber: currentPending.mobileNumber,
            portalStatus: "active",
          },
        ],
        { session }
      );

      await PendingRegistration.deleteOne(
        { _id: currentPending._id },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return verifiedUser;
};

const resendRegistrationOtp = async ({ email }) => {
  getEmailConfiguration();
  requireOtpSecret();

  const existingUser = await User.exists({ email });
  if (existingUser) {
    throw new AppError("Unable to resend verification code", 409);
  }

  const pending = await PendingRegistration.findOne({ email }).select(
    "+otpHash +passwordHash"
  );
  if (!pending) {
    throw new AppError("Registration session not found or expired", 400);
  }

  const elapsed = Date.now() - pending.lastOtpSentAt.getTime();
  if (elapsed < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS - elapsed) / 1000
    );
    throw new AppError(
      `Please wait ${remainingSeconds} seconds before requesting another code`,
      429
    );
  }

  const otp = generateOtp();
  const timing = buildOtpTiming();

  pending.otpHash = hashOtp(email, otp);
  pending.otpAttempts = 0;
  pending.otpExpiresAt = timing.otpExpiresAt;
  pending.lastOtpSentAt = timing.lastOtpSentAt;
  pending.expiresAt = timing.expiresAt;
  await pending.save();

  await sendVerificationEmail({
    email,
    firstName: pending.firstName,
    otp,
  });
};

module.exports = {
  registerPendingPatient,
  verifyPendingPatient,
  resendRegistrationOtp,
};
