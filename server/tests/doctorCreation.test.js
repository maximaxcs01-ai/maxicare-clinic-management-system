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
const original = {
  startSession: mongoose.startSession,
  serviceCountDocuments: Service.countDocuments,
  userCreate: User.create,
  userFindOne: User.findOne,
  doctorCreate: Doctor.create,
  doctorFindById: Doctor.findById,
  counterFindByIdAndUpdate: Counter.findByIdAndUpdate,
  jwtSecret: process.env.JWT_SECRET,
};

let storedUser;
let createdDoctorInput;
let createdUserCount;
let doctorResult;

const validForm = (temporaryPassword) => ({
  firstName: "Test",
  lastName: "Doctor",
  email: "doctor@example.test",
  mobileNumber: "09170000000",
  licenseNumber: "LIC-12345",
  specialization: "General Practice",
  serviceIds: [serviceId],
  status: "active",
  ...(temporaryPassword === undefined ? {} : { temporaryPassword }),
});

const runValidation = (body) => {
  let response;
  let nextCalled = false;
  const req = { method: "POST", body };
  const res = {
    status(statusCode) {
      response = { statusCode };
      return this;
    },
    json(payload) {
      response = { ...response, ...payload };
      return this;
    },
  };
  validateDoctor(req, res, () => {
    nextCalled = true;
  });
  return { req, response, nextCalled };
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  storedUser = null;
  createdDoctorInput = null;
  createdUserCount = 0;
  doctorResult = {
    _id: doctorId,
    firstName: "Test",
    lastName: "Doctor",
    email: "doctor@example.test",
    doctorNumber: "DR-000041",
    userId: { _id: userId, passwordSetupRequired: false, status: "active" },
    serviceIds: [{ _id: serviceId, name: "General Consultation", status: "active" }],
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  Service.countDocuments = () => ({
    session: async () => 1,
  });
  User.create = async ([data]) => {
    createdUserCount += 1;
    storedUser = { ...data, _id: userId };
    return [storedUser];
  };
  User.findOne = () => ({
    select: async () => storedUser,
  });
  Doctor.create = async ([data]) => {
    createdDoctorInput = data;
    return [{ ...doctorResult, ...data, _id: doctorId }];
  };
  Doctor.findById = () => ({
    populate() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(doctorResult).then(resolve, reject);
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
  if (original.jwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = original.jwtSecret;
  }
});

test("doctor create validator requires an 8–16 character temporary password", () => {
  for (const password of [undefined, "", "1234567", "12345678901234567"]) {
    const result = runValidation(validForm(password));
    assert.equal(result.nextCalled, false);
    assert.equal(result.response.statusCode, 400);
    assert.match(result.response.message, /Temporary password must be 8 to 16 characters/);
  }

  for (const password of ["12345678", "1234567890123456"]) {
    const result = runValidation(validForm(password));
    assert.equal(result.nextCalled, true);
    assert.equal(result.req.validatedDoctor.temporaryPassword, password);
  }
});

test("doctor is created with a hashed temporary password and can log in normally", async () => {
  const temporaryPassword = "TempPass8";
  const validation = runValidation(validForm(temporaryPassword));
  assert.equal(validation.nextCalled, true);

  const result = await createDoctor(validation.req.validatedDoctor, { _id: "actor" });

  assert.equal(createdUserCount, 1);
  assert.equal(storedUser.passwordSetupRequired, false);
  assert.equal(storedUser.emailVerified, true);
  assert.notEqual(storedUser.password, temporaryPassword);
  assert.equal(await bcrypt.compare(temporaryPassword, storedUser.password), true);
  assert.equal("temporaryPassword" in createdDoctorInput, false);
  assert.equal("temporaryPassword" in result.doctor, false);
  assert.equal("password" in result.doctor, false);
  assert.equal(result.doctor.doctorNumber, "DR-000041");

  let statusCode;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await authController.loginUser(
    {
      body: {
        email: "doctor@example.test",
        password: temporaryPassword,
      },
    },
    response,
    (error) => {
      throw error;
    }
  );

  assert.equal(statusCode, 200);
  assert.equal(responseBody.user.role, "doctor");
  assert.ok(responseBody.token);
});

test("duplicate doctor email remains rejected by the unique user constraint", async () => {
  User.create = async () => {
    const error = new Error("duplicate email");
    error.code = 11000;
    throw error;
  };

  await assert.rejects(
    createDoctor(
      runValidation(validForm("TempPass8")).req.validatedDoctor,
      { _id: "actor" }
    ),
    (error) => error.code === 11000
  );
});
