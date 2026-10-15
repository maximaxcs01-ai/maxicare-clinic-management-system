const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Counter = require("../models/Counter");
const Doctor = require("../models/Doctor");
const Service = require("../models/Service");
const User = require("../models/User");
const authController = require("../controllers/authController");
const { createDoctor } = require("../services/doctorService");
const { validateDoctor } = require("../validators/doctorValidator");

const serviceId = "650000000000000000000001";
const doctorId = "650000000000000000000002";
const userId = "650000000000000000000003";
const envKeys = ["JWT_SECRET", "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"];
const original = {
  startSession: mongoose.startSession,
  serviceCountDocuments: Service.countDocuments,
  userCreate: User.create,
  userFindOne: User.findOne,
  doctorCreate: Doctor.create,
  doctorFindById: Doctor.findById,
  counterFindByIdAndUpdate: Counter.findByIdAndUpdate,
  fetch: global.fetch,
  env: Object.fromEntries(envKeys.map((key) => [key, process.env[key]])),
};

let storedUser;
let createdDoctorInput;
let deliveredEmail;

const validForm = (extra = {}) => ({
  firstName: "Test", lastName: "Doctor", email: "doctor@example.test",
  mobileNumber: "09170000000", licenseNumber: "LIC-12345",
  specialization: "General Practice", serviceIds: [serviceId], status: "active",
  ...extra,
});

const runValidation = (body) => {
  let response;
  let nextCalled = false;
  const req = { method: "POST", body };
  const res = {
    status(statusCode) { response = { statusCode }; return this; },
    json(payload) { response = { ...response, ...payload }; return this; },
  };
  validateDoctor(req, res, () => { nextCalled = true; });
  return { req, response, nextCalled };
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.test";
  process.env.BREVO_SENDER_NAME = "Test Clinic";
  storedUser = null;
  createdDoctorInput = null;
  deliveredEmail = null;
  global.fetch = async (_url, options) => {
    deliveredEmail = JSON.parse(options.body);
    return { ok: true };
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(), endSession: async () => {},
  });
  Service.countDocuments = () => ({ session: async () => 1 });
  User.create = async ([data]) => { storedUser = { ...data, _id: userId }; return [storedUser]; };
  User.findOne = () => ({ select: async () => storedUser });
  Doctor.create = async ([data]) => { createdDoctorInput = data; return [{ ...data, _id: doctorId }]; };
  Doctor.findById = () => ({
    populate() { return this; },
    then(resolve, reject) {
      return Promise.resolve({
        ...createdDoctorInput, _id: doctorId, doctorNumber: "DR-000041",
        userId: { _id: userId, requiresPasswordChange: true, status: "active" },
      }).then(resolve, reject);
    },
  });
  Counter.findByIdAndUpdate = async () => ({ sequence: 41 });
});

afterEach(() => {
  mongoose.startSession = original.startSession;
  Service.countDocuments = original.serviceCountDocuments;
  User.create = original.userCreate;
  User.findOne = original.userFindOne;
  Doctor.create = original.doctorCreate;
  Doctor.findById = original.doctorFindById;
  Counter.findByIdAndUpdate = original.counterFindByIdAndUpdate;
  global.fetch = original.fetch;
  for (const [key, value] of Object.entries(original.env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("doctor create ignores an administrator-supplied temporary password", () => {
  const result = runValidation(validForm({ temporaryPassword: "AdminChosen8" }));
  assert.equal(result.nextCalled, true);
  assert.equal("temporaryPassword" in result.req.validatedDoctor, false);
});

test("doctor receives an emailed server-generated password and restricted login", async () => {
  const validation = runValidation(validForm());
  const result = await createDoctor(validation.req.validatedDoctor, { _id: "actor" });
  assert.equal(storedUser.passwordSetupRequired, false);
  assert.equal(storedUser.requiresPasswordChange, true);
  assert.equal(storedUser.emailVerified, true);
  assert.match(storedUser.password, /^\$2[aby]\$/);
  assert.equal(deliveredEmail.to[0].email, "doctor@example.test");
  const encodedPassword = deliveredEmail.htmlContent.match(/letter-spacing:1px\">([^<]+)</)[1];
  const temporaryPassword = encodedPassword
    .replaceAll("&amp;", "&").replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">");
  assert.equal(await bcrypt.compare(temporaryPassword, storedUser.password), true);
  assert.equal("temporaryPassword" in createdDoctorInput, false);
  assert.equal("password" in result.doctor, false);

  let statusCode;
  let responseBody;
  await authController.loginUser(
    { body: { email: storedUser.email, password: temporaryPassword } },
    {
      status(code) { statusCode = code; return this; },
      json(body) { responseBody = body; return this; },
    },
    (error) => { throw error; }
  );
  assert.equal(statusCode, 200);
  assert.equal(responseBody.mustChangePassword, true);
  assert.equal(responseBody.user.mustChangePassword, true);
});

test("duplicate doctor email remains rejected by the unique user constraint", async () => {
  User.create = async () => { const error = new Error("duplicate email"); error.code = 11000; throw error; };
  await assert.rejects(
    createDoctor(runValidation(validForm()).req.validatedDoctor, { _id: "actor" }),
    (error) => error.code === 11000
  );
});
