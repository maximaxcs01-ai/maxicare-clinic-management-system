const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { afterEach, beforeEach, test } = require("node:test");
const PendingRegistration = require("../models/PendingRegistration");
const Patient = require("../models/Patient");
const Counter = require("../models/Counter");
const User = require("../models/User");
const authService = require("../services/authService");
const { hashOtp } = require("../services/otpService");
const { validateRegistration } = require("../validators/authValidator");
const { CURRENT_TERMS_VERSION } = require("../config/terms");

const loadAuthController = () => {
  const controllerPath = require.resolve("../controllers/authController");
  delete require.cache[controllerPath];
  return require(controllerPath);
};

const original = {
  jwtSecret: process.env.JWT_SECRET,
  otpSecret: process.env.OTP_HASH_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  startSession: mongoose.startSession,
  pendingFindOne: PendingRegistration.findOne,
  pendingFindById: PendingRegistration.findById,
  pendingFindOneAndUpdate: PendingRegistration.findOneAndUpdate,
  pendingDeleteOne: PendingRegistration.deleteOne,
  userFindOne: User.findOne,
  userCreate: User.create,
  patientCreate: Patient.create,
  counterFindByIdAndUpdate: Counter.findByIdAndUpdate,
  verifyPendingPatient: authService.verifyPendingPatient,
};

let pendingRecord;
let createdUserInput;
let createdPatientInput;
let pendingDeleteCount;
let sessionStartCount;
let verificationResult;

function query(value) {
  return {
    select() {
      return this;
    },
    session() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-auth-session-secret";
  process.env.OTP_HASH_SECRET = "test-otp-secret";
  delete process.env.JWT_EXPIRES_IN;

  pendingRecord = {
    _id: "pending-registration-1",
    firstName: "Test",
    middleName: "",
    lastName: "Patient",
    email: "patient@example.test",
    mobileNumber: "09170000000",
    passwordHash: "bcrypt-hash",
    otpHash: hashOtp("patient@example.test", "123456"),
    otpAttempts: 0,
    otpExpiresAt: new Date(Date.now() + 60_000),
    termsAcceptedAt: new Date("2026-10-16T01:00:00.000Z"),
    privacyAcceptedAt: new Date("2026-10-16T01:00:00.000Z"),
    termsVersion: CURRENT_TERMS_VERSION,
  };
  createdUserInput = null;
  createdPatientInput = null;
  pendingDeleteCount = 0;
  sessionStartCount = 0;
  verificationResult = {
    _id: "verified-user-1",
    firstName: "Test",
    middleName: "",
    lastName: "Patient",
    email: "patient@example.test",
    role: "patient",
    status: "active",
    emailVerified: true,
    tokenVersion: 0,
  };

  mongoose.startSession = async () => {
    sessionStartCount += 1;
    return {
      withTransaction: async (callback) => callback(),
      endSession: async () => {},
    };
  };
  PendingRegistration.findOne = () => query(pendingRecord);
  PendingRegistration.findById = () => query(pendingRecord);
  PendingRegistration.findOneAndUpdate = async (_filter, update) => {
    if (update.$inc?.otpAttempts) {
      pendingRecord.otpAttempts += update.$inc.otpAttempts;
    }
    return pendingRecord;
  };
  PendingRegistration.deleteOne = async () => {
    pendingDeleteCount += 1;
    pendingRecord = null;
    return { deletedCount: 1 };
  };
  User.findOne = () => ({
    session: async () => null,
  });
  User.create = async ([input]) => {
    createdUserInput = input;
    return [verificationResult];
  };
  Patient.create = async ([input]) => {
    createdPatientInput = input;
    return [{}];
  };
  Counter.findByIdAndUpdate = async () => ({ sequence: 23 });
});

afterEach(() => {
  mongoose.startSession = original.startSession;
  PendingRegistration.findOne = original.pendingFindOne;
  PendingRegistration.findById = original.pendingFindById;
  PendingRegistration.findOneAndUpdate = original.pendingFindOneAndUpdate;
  PendingRegistration.deleteOne = original.pendingDeleteOne;
  User.findOne = original.userFindOne;
  User.create = original.userCreate;
  Patient.create = original.patientCreate;
  Counter.findByIdAndUpdate = original.counterFindByIdAndUpdate;
  authService.verifyPendingPatient = original.verifyPendingPatient;

  for (const [name, value] of [
    ["JWT_SECRET", original.jwtSecret],
    ["OTP_HASH_SECRET", original.otpSecret],
    ["JWT_EXPIRES_IN", original.jwtExpiresIn],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("wrong OTP does not create or authenticate a Patient", async () => {
  await assert.rejects(
    authService.verifyPendingPatient({
      email: "patient@example.test",
      otp: "000000",
    }),
    (error) => error.statusCode === 400
  );

  assert.equal(sessionStartCount, 0);
  assert.equal(createdUserInput, null);
  assert.equal(createdPatientInput, null);
  assert.equal(pendingDeleteCount, 0);
  assert.equal(pendingRecord.otpAttempts, 1);
});

test("expired OTP does not create or authenticate a Patient", async () => {
  pendingRecord.otpExpiresAt = new Date(Date.now() - 1);

  await assert.rejects(
    authService.verifyPendingPatient({
      email: "patient@example.test",
      otp: "123456",
    }),
    (error) => error.statusCode === 400
  );

  assert.equal(sessionStartCount, 0);
  assert.equal(createdUserInput, null);
  assert.equal(pendingDeleteCount, 0);
});

test("valid OTP creates the linked Patient and removes PendingRegistration", async () => {
  const user = await authService.verifyPendingPatient({
    email: "patient@example.test",
    otp: "123456",
  });

  assert.equal(user, verificationResult);
  assert.equal(sessionStartCount, 1);
  assert.equal(createdUserInput.emailVerified, true);
  assert.equal(createdUserInput.role, "patient");
  assert.equal(createdUserInput.password, "bcrypt-hash");
  assert.equal(createdUserInput.termsVersion, CURRENT_TERMS_VERSION);
  assert.equal(
    createdUserInput.termsAcceptedAt.toISOString(),
    "2026-10-16T01:00:00.000Z"
  );
  assert.equal(
    createdUserInput.privacyAcceptedAt.toISOString(),
    "2026-10-16T01:00:00.000Z"
  );
  assert.equal(createdPatientInput.userId, verificationResult._id);
  assert.equal(createdPatientInput.patientNumber, "PT-000023");
  assert.equal(pendingDeleteCount, 1);
  assert.equal(pendingRecord, null);
});

test("email verification returns the same signed session shape as login", async () => {
  const user = {
    _id: "verified-user-1",
    firstName: "Test",
    middleName: "",
    lastName: "Patient",
    email: "patient@example.test",
    role: "patient",
    tokenVersion: 0,
  };
  authService.verifyPendingPatient = async () => user;
  const { verifyEmail } = loadAuthController();
  let statusCode;
  let responseBody;
  let nextError;

  await verifyEmail(
    { validatedAuth: { email: user.email, otp: "123456" } },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
      },
    },
    (error) => {
      nextError = error;
    }
  );

  assert.equal(nextError, undefined);
  assert.equal(statusCode, 201);
  assert.equal(responseBody.user.role, "patient");
  assert.equal(responseBody.user.email, user.email);
  assert.equal(typeof responseBody.token, "string");
  assert.deepEqual(jwt.verify(responseBody.token, process.env.JWT_SECRET), {
    id: user._id,
    role: "patient",
    tokenVersion: 0,
    iat: jwt.verify(responseBody.token, process.env.JWT_SECRET).iat,
    exp: jwt.verify(responseBody.token, process.env.JWT_SECRET).exp,
  });
  assert.equal("password" in responseBody, false);
  assert.equal("otp" in responseBody, false);
  assert.equal("password" in responseBody.user, false);
});

test("failed email verification does not return an authentication session", async () => {
  const verificationError = new Error("Invalid email or verification code");
  authService.verifyPendingPatient = async () => {
    throw verificationError;
  };
  const { verifyEmail } = loadAuthController();
  let statusCalled = false;
  let nextError;

  await verifyEmail(
    { validatedAuth: { email: "patient@example.test", otp: "000000" } },
    {
      status() {
        statusCalled = true;
        return this;
      },
      json() {},
    },
    (error) => {
      nextError = error;
    }
  );

  assert.equal(statusCalled, false);
  assert.equal(nextError, verificationError);
});

test("registration password policy is exactly 8 to 16 characters", () => {
  const validate = (password) => {
    const req = {
      body: {
        firstName: "Test",
        middleName: "",
        lastName: "Patient",
        email: "patient@example.test",
        mobileNumber: "09170000000",
        password,
        confirmPassword: password,
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
      },
    };
    let statusCode;
    let nextCalled = false;
    validateRegistration(
      req,
      {
        status(code) {
          statusCode = code;
          return this;
        },
        json() {},
      },
      () => {
        nextCalled = true;
      }
    );
    return { req, statusCode, nextCalled };
  };

  assert.equal(validate("1234567").statusCode, 400);
  assert.equal(validate("12345678").nextCalled, true);
  assert.equal(validate("1234567890123456").nextCalled, true);
  assert.equal(validate("12345678901234567").statusCode, 400);
});

test("registration requires explicit acceptance of the current policies", () => {
  const validBody = {
    firstName: "Test",
    middleName: "",
    lastName: "Patient",
    email: "patient@example.test",
    mobileNumber: "09170000000",
    password: "12345678",
    confirmPassword: "12345678",
    termsAccepted: true,
    privacyAccepted: true,
    termsVersion: CURRENT_TERMS_VERSION,
  };
  const run = (overrides = {}) => {
    const req = { body: { ...validBody, ...overrides } };
    let response;
    let nextCalled = false;
    validateRegistration(
      req,
      {
        status(status) {
          response = { status };
          return this;
        },
        json(body) {
          response.body = body;
        },
      },
      () => {
        nextCalled = true;
      }
    );
    return { req, response, nextCalled };
  };

  assert.equal(run({ termsAccepted: false }).response.status, 400);
  assert.equal(run({ privacyAccepted: false }).response.status, 400);
  assert.equal(
    run({
      termsAccepted: undefined,
      privacyAccepted: undefined,
      termsVersion: undefined,
    }).response.status,
    400
  );
  assert.equal(run({ termsVersion: "outdated" }).response.status, 400);
  assert.equal(run({ termsAccepted: "true" }).response.status, 400);
  assert.equal(run({ privacyAccepted: undefined }).response.status, 400);
  const accepted = run();
  assert.equal(accepted.nextCalled, true);
  assert.equal(accepted.req.validatedAuth.termsVersion, CURRENT_TERMS_VERSION);
  assert.equal("termsAcceptedAt" in accepted.req.validatedAuth, false);
  assert.equal("privacyAcceptedAt" in accepted.req.validatedAuth, false);
});

test("legacy pending registration without consent metadata can still finish OTP verification", async () => {
  delete pendingRecord.termsAcceptedAt;
  delete pendingRecord.privacyAcceptedAt;
  delete pendingRecord.termsVersion;

  await authService.verifyPendingPatient({
    email: "patient@example.test",
    otp: "123456",
  });

  assert.equal("termsAcceptedAt" in createdUserInput, false);
  assert.equal("privacyAcceptedAt" in createdUserInput, false);
  assert.equal("termsVersion" in createdUserInput, false);
});

test("existing User without consent metadata still receives a normal login session", async () => {
  const password = "Existing-Password-1";
  const existingUser = {
    _id: "existing-user-1",
    firstName: "Existing",
    middleName: "",
    lastName: "Patient",
    email: "existing@example.test",
    password: await bcrypt.hash(password, 4),
    role: "patient",
    status: "active",
    emailVerified: true,
    passwordSetupRequired: false,
    requiresPasswordChange: false,
    tokenVersion: 0,
  };
  User.findOne = () => query(existingUser);
  const { loginUser } = loadAuthController();
  let statusCode;
  let responseBody;
  let nextError;

  await loginUser(
    { body: { email: existingUser.email, password } },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
      },
    },
    (error) => {
      nextError = error;
    }
  );

  assert.equal(nextError, undefined);
  assert.equal(statusCode, 200);
  assert.equal(responseBody.message, "Login successful");
  assert.equal(responseBody.user.email, existingUser.email);
  assert.equal(responseBody.mustChangePassword, false);
});
