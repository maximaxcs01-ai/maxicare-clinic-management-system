const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const AccountSetupToken = require("../models/AccountSetupToken");
const Patient = require("../models/Patient");
const User = require("../models/User");
const { recordAudit } = require("./auditService");
const AppError = require("../utils/AppError");
const { requireOtpSecret, hashAccountSetupToken, verifyAccountSetupTokenHash } = require("./otpService");
const {
  sendDoctorInvitationEmail,
  sendPatientInvitationEmail,
} = require("./emailService");

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
  await sendAccountSetupInvitation(user, "doctor");
};

const sendPatientInvitation = async (user) => {
  await sendAccountSetupInvitation(user, "patient");
};

const sendAccountSetupInvitation = async (user, role) => {
  const origin = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const token = generateSetupToken();

  await createSetupTokenRecord({ userId: user._id, email: user.email, token });

  const setupUrl = `${origin}/setup-account?token=${encodeURIComponent(token)}`;
  const sendInvitationEmail =
    role === "patient" ? sendPatientInvitationEmail : sendDoctorInvitationEmail;
  await sendInvitationEmail({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    setupUrl,
  });
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

const completeSetup = async ({ token, newPassword, confirmPassword }, request) => {
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

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const session = await mongoose.startSession();
  let completedUser;
  try {
    await session.withTransaction(async () => {
      const tokenRecord = await AccountSetupToken.findById(record._id).session(session);
      const user = await User.findById(record.userId)
        .select("+password +passwordSetupRequired +tokenVersion")
        .session(session);
      if (!tokenRecord || tokenRecord.expiresAt.getTime() <= Date.now() || !user) {
        throw new AppError("This account setup link is invalid or has expired.", 400);
      }
      if (user.passwordSetupRequired !== true) {
        throw new AppError(
          "This account setup link has already been used or has expired.",
          400
        );
      }

      completedUser = await User.findOneAndUpdate(
        { _id: user._id, passwordSetupRequired: true },
        {
          $set: {
            password: passwordHash,
            passwordSetupRequired: false,
            requiresPasswordChange: false,
            emailVerified: true,
            tokenVersion: (user.tokenVersion || 0) + 1,
          },
        },
        { new: true, runValidators: true, session }
      );
      if (!completedUser) {
        throw new AppError(
          "This account setup link has already been used or has expired.",
          400
        );
      }

      await Patient.updateOne(
        { userId: user._id },
        { $set: { portalStatus: "active" } },
        { session }
      );
      if (request) {
        await recordAudit(
          {
            actorUserId: completedUser._id,
            actorRole: completedUser.role,
            action: "account.password_setup_completed",
            entityType: "User",
            entityId: completedUser._id,
            description: "Account password setup completed.",
            metadata: { userId: completedUser._id },
          },
          request,
          session
        );
      }
      await AccountSetupToken.deleteOne({ _id: record._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  return {
    userId: completedUser._id,
    email: completedUser.email,
  };
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
  sendPatientInvitation,
  validateSetupToken,
  completeSetup,
  resendInvitation,
};
