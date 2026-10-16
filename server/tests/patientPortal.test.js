const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const AccountSetupToken = require("../models/AccountSetupToken");
const Patient = require("../models/Patient");
const User = require("../models/User");
const accountSetupService = require("../services/accountSetupService");
const patientPortalService = require("../services/patientPortalService");
const { hashAccountSetupToken } = require("../services/otpService");

const patientId = "510000000000000000000001";
const userId = "520000000000000000000001";
const email = "walkin@example.test";

const original = {
  startSession: mongoose.startSession,
  patientFindById: Patient.findById,
  patientFindOne: Patient.findOne,
  patientCreate: Patient.create,
  patientUpdateOne: Patient.updateOne,
  userFindOne: User.findOne,
  userFindById: User.findById,
  userCreate: User.create,
  userFindOneAndUpdate: User.findOneAndUpdate,
  accountTokenFind: AccountSetupToken.find,
  accountTokenFindById: AccountSetupToken.findById,
  accountTokenDeleteMany: AccountSetupToken.deleteMany,
  accountTokenDeleteOne: AccountSetupToken.deleteOne,
  sendPatientInvitation: accountSetupService.sendPatientInvitation,
  clientOrigin: process.env.CLIENT_ORIGIN,
};

const query = (resolve) => ({
  select() {
    return this;
  },
  session() {
    return this;
  },
  then(resolvePromise, rejectPromise) {
    return Promise.resolve().then(resolve).then(resolvePromise, rejectPromise);
  },
});

let patient;
let createdUsers;
let inviteCount;
let tokenRecord;
let user;

beforeEach(() => {
  process.env.OTP_HASH_SECRET = "test-secret-for-account-setup";
  process.env.CLIENT_ORIGIN = "https://maxicare-clinic.vercel.app/";
  patient = {
    _id: patientId,
    firstName: "Walkin",
    lastName: "Patient",
    email,
    portalStatus: "not_activated",
    userId: undefined,
    async save() {},
  };
  createdUsers = [];
  inviteCount = 0;
  user = {
    _id: userId,
    firstName: "Walkin",
    lastName: "Patient",
    email,
    role: "patient",
    status: "active",
    passwordSetupRequired: true,
    emailVerified: false,
    tokenVersion: 0,
  };
  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => {},
  });
  Patient.findById = () => query(() => patient);
  Patient.findOne = () => query(() => null);
  Patient.create = async () => {
    throw new Error("Activation must not create Patient records");
  };
  Patient.updateOne = async () => ({ modifiedCount: 1 });
  User.findOne = () => query(() => null);
  User.findById = () => query(() => user);
  User.create = async ([data]) => {
    const created = { ...data, _id: userId };
    createdUsers.push(created);
    user = created;
    return [created];
  };
  User.findOneAndUpdate = async (filter, update) => {
    if (!user || String(user._id) !== String(filter._id)) return null;
    Object.assign(user, update.$set);
    return user;
  };
  AccountSetupToken.find = () => ({
    select: async () => (tokenRecord ? [tokenRecord] : []),
  });
  AccountSetupToken.findById = () => query(() => tokenRecord);
  AccountSetupToken.deleteMany = async () => ({ deletedCount: 0 });
  AccountSetupToken.deleteOne = async () => {
    tokenRecord = null;
  };
  accountSetupService.sendPatientInvitation = async () => {
    inviteCount += 1;
  };
});

afterEach(() => {
  mongoose.startSession = original.startSession;
  Patient.findById = original.patientFindById;
  Patient.findOne = original.patientFindOne;
  Patient.create = original.patientCreate;
  Patient.updateOne = original.patientUpdateOne;
  User.findOne = original.userFindOne;
  User.findById = original.userFindById;
  User.create = original.userCreate;
  User.findOneAndUpdate = original.userFindOneAndUpdate;
  AccountSetupToken.find = original.accountTokenFind;
  AccountSetupToken.findById = original.accountTokenFindById;
  AccountSetupToken.deleteMany = original.accountTokenDeleteMany;
  AccountSetupToken.deleteOne = original.accountTokenDeleteOne;
  accountSetupService.sendPatientInvitation = original.sendPatientInvitation;
  delete process.env.OTP_HASH_SECRET;
  if (original.clientOrigin === undefined) {
    delete process.env.CLIENT_ORIGIN;
  } else {
    process.env.CLIENT_ORIGIN = original.clientOrigin;
  }
});

test("builds an absolute walk-in activation URL for the setup-account route", () => {
  const setupUrl = accountSetupService.buildAccountSetupUrl("token/with unsafe chars");
  const parsed = new URL(setupUrl);

  assert.equal(parsed.origin, "https://maxicare-clinic.vercel.app");
  assert.equal(parsed.pathname, "/setup-account");
  assert.equal(parsed.searchParams.get("token"), "token/with unsafe chars");
  assert.match(setupUrl, /^https:\/\//);
});

test("uses the first canonical CLIENT_ORIGIN entry when CORS has multiple origins", () => {
  process.env.CLIENT_ORIGIN =
    "https://maxicare-clinic.vercel.app, http://localhost:5173";

  assert.equal(
    accountSetupService.buildAccountSetupUrl("safe-token"),
    "https://maxicare-clinic.vercel.app/setup-account?token=safe-token"
  );
});

test("rejects a missing frontend origin instead of creating a broken link", () => {
  delete process.env.CLIENT_ORIGIN;

  assert.throws(
    () => accountSetupService.buildAccountSetupUrl("safe-token"),
    (error) => error.statusCode === 503 && /Frontend URL configuration/.test(error.message)
  );
});

test("rejects a malformed frontend origin without an HTTP protocol", () => {
  process.env.CLIENT_ORIGIN = "maxicare-clinic.vercel.app";

  assert.throws(
    () => accountSetupService.buildAccountSetupUrl("safe-token"),
    (error) => error.statusCode === 503 && /Frontend URL configuration/.test(error.message)
  );
});

test("does not replace a setup token when the frontend origin is invalid", async () => {
  delete process.env.CLIENT_ORIGIN;
  let tokenStoreTouched = false;
  AccountSetupToken.deleteMany = async () => {
    tokenStoreTouched = true;
  };

  await assert.rejects(
    original.sendPatientInvitation(user),
    (error) => error.statusCode === 503
  );
  assert.equal(tokenStoreTouched, false);
});

test("activates a walk-in by linking its existing Patient record", async () => {
  const result = await patientPortalService.activatePatientPortal(patientId);
  assert.equal(patient._id, patientId);
  assert.equal(patient.userId, userId);
  assert.equal(patient.portalStatus, "invited");
  assert.equal(createdUsers.length, 1);
  assert.equal(createdUsers[0].role, "patient");
  assert.equal(createdUsers[0].passwordSetupRequired, true);
  assert.equal(createdUsers[0].emailVerified, false);
  assert.equal(inviteCount, 1);
  assert.equal(result.portalStatus, "invited");
});

test("blocks activation when the patient email belongs to a non-patient account", async () => {
  User.findOne = () =>
    query(() => ({ _id: userId, role: "doctor", status: "active" }));
  await assert.rejects(
    patientPortalService.activatePatientPortal(patientId),
    { statusCode: 409 }
  );
  assert.equal(patient.userId, undefined);
  assert.equal(createdUsers.length, 0);
  assert.equal(inviteCount, 0);
});

test("links an existing verified patient account without creating a new User", async () => {
  const existingUser = {
    _id: userId,
    role: "patient",
    status: "active",
    passwordSetupRequired: false,
    emailVerified: true,
  };
  User.findOne = () => query(() => existingUser);
  const result = await patientPortalService.activatePatientPortal(patientId);
  assert.equal(patient.userId, userId);
  assert.equal(patient.portalStatus, "active");
  assert.equal(createdUsers.length, 0);
  assert.equal(inviteCount, 0);
  assert.equal(result.portalStatus, "active");
});

test("resends a pending patient activation invitation", async () => {
  patient.userId = userId;
  patient.portalStatus = "invited";
  User.findOne = () => query(() => user);
  const result = await patientPortalService.resendPatientActivation(patientId);
  assert.equal(result.message, "Patient activation invitation resent.");
  assert.equal(inviteCount, 1);
});

test("keeps activation recoverable when email delivery fails", async () => {
  accountSetupService.sendPatientInvitation = async () => {
    throw new Error("Email unavailable");
  };
  await assert.rejects(
    patientPortalService.activatePatientPortal(patientId),
    /activation email could not be sent/
  );
  assert.equal(patient.userId, userId);
  assert.equal(patient.portalStatus, "invited");
  User.findOne = () => query(() => user);
  accountSetupService.sendPatientInvitation = async () => {
    inviteCount += 1;
  };
  const result = await patientPortalService.resendPatientActivation(patientId);
  assert.equal(result.message, "Patient activation invitation resent.");
  assert.equal(inviteCount, 1);
});

test("completing account setup activates the linked Patient portal", async () => {
  user.requiresPasswordChange = true;
  const token = "high-entropy-setup-token";
  tokenRecord = {
    _id: "530000000000000000000001",
    userId,
    email,
    tokenHash: hashAccountSetupToken(email, token),
    expiresAt: new Date(Date.now() + 60_000),
  };
  const PatientUpdate = Patient.updateOne;
  let portalActivated = false;
  Patient.updateOne = async (filter, update) => {
    assert.equal(String(filter.userId), userId);
    assert.equal(update.$set.portalStatus, "active");
    portalActivated = true;
    return { modifiedCount: 1 };
  };

  const result = await accountSetupService.completeSetup({
    token,
    newPassword: "SecurePass123",
    confirmPassword: "SecurePass123",
  });
  assert.equal(String(result.userId), userId);
  assert.equal(user.passwordSetupRequired, false);
  assert.equal(user.requiresPasswordChange, false);
  assert.equal(user.emailVerified, true);
  assert.equal(user.tokenVersion, 1);
  assert.equal(portalActivated, true);
  assert.equal(tokenRecord, null);

  await assert.rejects(
    accountSetupService.completeSetup({
      token,
      newPassword: "SecurePass123",
      confirmPassword: "SecurePass123",
    }),
    /already been used or has expired/
  );
  Patient.updateOne = PatientUpdate;
});

test("rejects invalid password length and confirmation before account activation", async () => {
  await assert.rejects(
    accountSetupService.completeSetup({
      token: "unused-token",
      newPassword: "short",
      confirmPassword: "short",
    }),
    /8 to 16 characters/
  );

  await assert.rejects(
    accountSetupService.completeSetup({
      token: "unused-token",
      newPassword: "SecurePass123",
      confirmPassword: "Different123",
    }),
    /Passwords do not match/
  );
});
