const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

const AccountSetupToken = require("../models/AccountSetupToken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { requireOtpSecret, hashAccountSetupToken, verifyAccountSetupTokenHash } = require("./otpService");
const { sendDoctorInvitationEmail } = require("./emailService");

const SETUP_TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000;

const generateSetupToken = () => crypto.randomBytes(32).toString("base64url");

const maskEmail = (email = "") => {
  const [localPart, domainPart] = email.split("@");
  if (!domainPart) return "***";
  if (localPart.length <= 2) {
    return `${localPart.slice(0, 1) || ""}***@${domainPart}`;
  }
  return `${localPart.slice(0, 2)}***@${domainPart}`;
};

const createSetupTokenRecord = async ({ userId, email, token }) => {
  requireOtpSecret();
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_VALIDITY_MS);
  const tokenHash = hashAccountSetupToken(email, token);

  await AccountSetupToken.deleteMany({ userId });
  await AccountSetupToken.create({
    userId,
    email,
    tokenHash,
    expiresAt,
  });

  return { expiresAt };
};

const sendDoctorInvitation = async (user) => {
  const origin = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const token = generateSetupToken();

  await createSetupTokenRecord({ userId: user._id, email: user.email, token });

  const setupUrl = `${origin}/setup-account?token=${encodeURIComponent(token)}`;
  await sendDoctorInvitationEmail({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    setupUrl,
  });

  return { token, setupUrl };
};

const findMatchingAccountSetupToken = async (token) => {
  const records = await AccountSetupToken.find({ expiresAt: { $gt: new Date() } }).select("+tokenHash email userId");

  for (const record of records) {
    if (verifyAccountSetupTokenHash(record.email, token, record.tokenHash)) {
      return record;
    }
  }

  return null;
};

const validateSetupToken = async (token) => {
  if (!token || typeof token !== "string") {
    return { valid: false, message: "This account setup link is invalid or has expired." };
  }

  const record = await findMatchingAccountSetupToken(token);
  if (!record) {
    return { valid: false, message: "This account setup link is invalid or has expired." };
  }

  const user = await User.findById(record.userId).select("email passwordSetupRequired");
  if (!user || user.passwordSetupRequired !== true) {
    return { valid: false, message: "This account setup link has already been used or has expired." };
  }

  return {
    valid: true,
    email: maskEmail(record.email),
  };
};

const completeSetup = async ({ token, newPassword, confirmPassword }) => {
  if (!token || typeof token !== "string") {
    throw new AppError("This account setup link is invalid or has expired.", 400);
  }

  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 16) {
    throw new AppError("Password must be 8 to 16 characters", 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError("Passwords do not match", 400);
  }

  const record = await findMatchingAccountSetupToken(token);
  if (!record) {
    throw new AppError("This account setup link has already been used or has expired.", 400);
  }

  const user = await User.findById(record.userId).select("+password +passwordSetupRequired +tokenVersion");
  if (!user) {
    throw new AppError("This account setup link is invalid or has expired.", 400);
  }

  if (user.passwordSetupRequired !== true) {
    throw new AppError("This account setup link has already been used or has expired.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        password: passwordHash,
        passwordSetupRequired: false,
        tokenVersion: (user.tokenVersion || 0) + 1,
      },
    },
    { runValidators: true }
  );

  await AccountSetupToken.deleteOne({ _id: record._id });

  return { userId: user._id, email: user.email };
};

const resendInvitation = async (user) => {
  if (!user || user.passwordSetupRequired !== true) {
    throw new AppError("Doctor account setup is already complete", 409);
  }

  await sendDoctorInvitation(user);
  return { message: "Account setup invitation sent successfully." };
};

module.exports = {
  SETUP_TOKEN_VALIDITY_MS,
  maskEmail,
  generateSetupToken,
  sendDoctorInvitation,
  validateSetupToken,
  completeSetup,
  resendInvitation,
};
