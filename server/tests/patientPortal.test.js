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
  accountTokenDeleteOne: AccountSetupToken.deleteOne,
  sendPatientInvitation: accountSetupService.sendPatientInvitation,
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
    select: async () => [tokenRecord],
  });
  AccountSetupToken.findById = () => query(() => tokenRecord);
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
  AccountSetupToken.deleteOne = original.accountTokenDeleteOne;
  accountSetupService.sendPatientInvitation = original.sendPatientInvitation;
  delete process.env.OTP_HASH_SECRET;
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
  assert.equal(user.emailVerified, true);
  assert.equal(user.tokenVersion, 1);
  assert.equal(portalActivated, true);
  assert.equal(tokenRecord, null);
  Patient.updateOne = PatientUpdate;
});
