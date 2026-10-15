const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const PendingRegistration = require("../models/PendingRegistration");
const User = require("../models/User");
const { registerPendingPatient } = require("../services/authService");

const original = {
  apiKey: process.env.BREVO_API_KEY,
  senderEmail: process.env.BREVO_SENDER_EMAIL,
  senderName: process.env.BREVO_SENDER_NAME,
  otpSecret: process.env.OTP_HASH_SECRET,
  fetch: global.fetch,
  consoleError: console.error,
  pendingFindOneAndUpdate: PendingRegistration.findOneAndUpdate,
  userExists: User.exists,
  userCreate: User.create,
};

let pendingWrites;
let userCreateCount;
let fetchCount;
let logs;

beforeEach(() => {
  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "clinic@example.test";
  process.env.BREVO_SENDER_NAME = "Clinic";
  process.env.OTP_HASH_SECRET = "test-otp-secret";
  pendingWrites = [];
  userCreateCount = 0;
  fetchCount = 0;
  logs = [];

  PendingRegistration.findOneAndUpdate = async (filter, update, options) => {
    pendingWrites.push({ filter, update, options });
    return {};
  };
  User.exists = async () => null;
  User.create = async () => {
    userCreateCount += 1;
    throw new Error("User creation must wait for OTP verification");
  };
  console.error = (message) => logs.push(message);
  global.fetch = async () => {
    fetchCount += 1;
    if (fetchCount === 1) {
      return {
        ok: false,
        status: 503,
        json: async () => ({
          code: "temporarily_unavailable",
          message: "Provider temporarily unavailable",
        }),
      };
    }
    return { ok: true, status: 201 };
  };
});

afterEach(() => {
  global.fetch = original.fetch;
  console.error = original.consoleError;
  PendingRegistration.findOneAndUpdate = original.pendingFindOneAndUpdate;
  User.exists = original.userExists;
  User.create = original.userCreate;

  const environment = [
    ["BREVO_API_KEY", original.apiKey],
    ["BREVO_SENDER_EMAIL", original.senderEmail],
    ["BREVO_SENDER_NAME", original.senderName],
    ["OTP_HASH_SECRET", original.otpSecret],
  ];
  for (const [name, value] of environment) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

test("failed OTP delivery retains one pending registration for a safe retry", async () => {
  const registration = {
    firstName: "Test",
    middleName: "",
    lastName: "Patient",
    email: "retry@example.test",
    mobileNumber: "09170000000",
    password: "Strong-Test-Password-1!",
  };

  await assert.rejects(
    registerPendingPatient(registration),
    (error) => error.statusCode === 502
  );

  assert.equal(pendingWrites.length, 1);
  assert.equal(pendingWrites[0].filter.email, registration.email);
  assert.equal(pendingWrites[0].options.upsert, true);
  assert.ok(pendingWrites[0].update.$set.passwordHash);
  assert.ok(pendingWrites[0].update.$set.otpHash);
  assert.equal("otp" in pendingWrites[0].update.$set, false);
  assert.equal(userCreateCount, 0);

  const result = await registerPendingPatient(registration);

  assert.deepEqual(result, { email: registration.email });
  assert.equal(pendingWrites.length, 2);
  assert.equal(pendingWrites[1].filter.email, registration.email);
  assert.equal(pendingWrites[1].options.upsert, true);
  assert.equal(userCreateCount, 0);
  assert.equal(fetchCount, 2);
  assert.equal(JSON.parse(logs[0]).status, 503);
});
