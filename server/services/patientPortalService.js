const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Patient = require("../models/Patient");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const accountSetupService = require("./accountSetupService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const assertPatientId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Invalid patient", 400);
};

const activatePatientPortal = async (patientId) => {
  assertPatientId(patientId);
  const session = await mongoose.startSession();
  let activationUser;
  let needsInvitation = false;

  try {
    await session.withTransaction(async () => {
      const patient = await Patient.findById(patientId).session(session);
      if (!patient) throw new AppError("Patient not found", 404);
      if (!EMAIL_PATTERN.test(patient.email || "")) {
        throw new AppError("A valid patient email is required to activate the portal.", 400);
      }
      if (patient.userId || patient.portalStatus === "active") {
        throw new AppError("This patient already has portal access or an invitation.", 409);
      }

      let user = await User.findOne({ email: patient.email.toLowerCase() }).session(session);
      if (user) {
        if (user.role !== "patient" || user.status !== "active") {
          throw new AppError("This email is already in use by another account.", 409);
        }
        if (!user.passwordSetupRequired && !user.emailVerified) {
          throw new AppError("The existing account email must be verified before linking.", 409);
        }
        const linkedPatient = await Patient.findOne({ userId: user._id }).session(session);
        if (linkedPatient && String(linkedPatient._id) !== String(patient._id)) {
          throw new AppError("This account is already linked to another patient record.", 409);
        }
        needsInvitation = user.passwordSetupRequired === true;
      } else {
        const password = await bcrypt.hash(
          crypto.randomBytes(32).toString("base64url"),
          10
        );
        [user] = await User.create(
          [
            {
              firstName: patient.firstName,
              middleName: patient.middleName,
              lastName: patient.lastName,
              email: patient.email.toLowerCase(),
              password,
              role: "patient",
              status: "active",
              emailVerified: false,
              passwordSetupRequired: true,
            },
          ],
          { session }
        );
        needsInvitation = true;
      }

      patient.userId = user._id;
      patient.portalStatus = needsInvitation ? "invited" : "active";
      await patient.save({ session });
      activationUser = user;
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("This email is already in use by another account.", 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (needsInvitation) {
    try {
      await accountSetupService.sendPatientInvitation(activationUser);
    } catch (error) {
      throw new AppError(
        "The patient record is linked, but the activation email could not be sent. Resend the invitation from Patients.",
        error.statusCode || 502
      );
    }
  }

  return {
    message: needsInvitation
      ? "Patient portal linked and activation invitation sent."
      : "Existing patient account linked to this record.",
    portalStatus: needsInvitation ? "invited" : "active",
  };
};

const resendPatientActivation = async (patientId) => {
  assertPatientId(patientId);
  const patient = await Patient.findById(patientId);
  if (!patient) throw new AppError("Patient not found", 404);
  if (patient.portalStatus !== "invited" || !patient.userId) {
    throw new AppError("This patient has no pending portal invitation.", 409);
  }

  const user = await User.findOne({
    _id: patient.userId,
    role: "patient",
    passwordSetupRequired: true,
  }).select("firstName lastName email passwordSetupRequired");
  if (!user) {
    throw new AppError("The pending patient account could not be found.", 409);
  }

  await accountSetupService.sendPatientInvitation(user);
  return { message: "Patient activation invitation resent." };
};

module.exports = { activatePatientPortal, resendPatientActivation };
