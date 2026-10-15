const assert = require("node:assert/strict");
const path = require("node:path");
const { after, before, test } = require("node:test");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

const RUN_INTEGRATION = process.env.RUN_ATLAS_INTEGRATION === "1";
const TEST_DATABASE = "clinic_consultation_integration_test";

const withDatabase = (mongoUri, databaseName) => {
  const separatorIndex = mongoUri.indexOf("?");
  const query = separatorIndex >= 0 ? mongoUri.slice(separatorIndex) : "";
  const base = separatorIndex >= 0 ? mongoUri.slice(0, separatorIndex) : mongoUri;
  const slashIndex = base.lastIndexOf("/");
  if (slashIndex < 0) throw new Error("MONGO_URI has no database path");
  return `${base.slice(0, slashIndex + 1)}${databaseName}${query}`;
};

if (!RUN_INTEGRATION) {
  test.skip(
    "consultation draft persists through HTTP, refetch, and prescription context",
    () => {}
  );
} else {
  const originalMongoUri = process.env.MONGO_URI;
  if (!originalMongoUri) throw new Error("MONGO_URI is required");
  process.env.MONGO_URI = withDatabase(originalMongoUri, TEST_DATABASE);

  const jwt = require("jsonwebtoken");
  const mongoose = require("mongoose");
  const app = require("../app");
  const connectDB = require("../config/db");
  const Consultation = require("../models/Consultation");
  const Doctor = require("../models/Doctor");
  const User = require("../models/User");

  let server;
  let baseUrl;
  let token;
  let currentConsultationId;
  let cancelledConsultationId;

  const expectedDraft = {
    chiefComplaint: "Persistent abdominal pain",
    symptoms: "Nausea and mild fever",
    diagnosis: "Acute gastroenteritis",
    treatmentPlan: "Hydration and supportive treatment",
    instructions: "Increase fluids and return if symptoms worsen",
    privateNotes: "Internal doctor test note",
    vitals: {},
  };

  const request = async (method, pathname, body) => {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { response, json: await response.json() };
  };

  before(async () => {
    await connectDB();
    assert.equal(
      mongoose.connection.name,
      TEST_DATABASE,
      "Integration test must never use the clinic database"
    );

    const user = await User.create({
      firstName: "Integration",
      lastName: "Doctor",
      email: "consultation-integration-doctor@example.test",
      password: "not-used-for-login",
      role: "doctor",
      status: "active",
      emailVerified: true,
      tokenVersion: 0,
    });
    const doctor = await Doctor.create({
      userId: user._id,
      doctorNumber: "INT-DOC-001",
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobileNumber: "09123456789",
      licenseNumber: "INT-LICENSE-001",
      specialization: "Integration Testing",
      status: "active",
    });

    const appointmentId = new mongoose.Types.ObjectId();
    const patientId = new mongoose.Types.ObjectId();
    const serviceId = new mongoose.Types.ObjectId();
    const cancelled = await Consultation.create({
      appointmentId,
      patientId,
      doctorId: doctor._id,
      serviceId,
      status: "cancelled",
      chiefComplaint: "Stale cancelled complaint",
      diagnosis: "Stale cancelled diagnosis",
      createdBy: user._id,
      updatedBy: user._id,
    });
    const current = await Consultation.create({
      appointmentId,
      patientId,
      doctorId: doctor._id,
      serviceId,
      status: "in_progress",
      createdBy: user._id,
      updatedBy: user._id,
    });
    cancelledConsultationId = String(cancelled._id);
    currentConsultationId = String(current._id);
    token = jwt.sign(
      { id: String(user._id), role: "doctor", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      server.close();
      server.closeAllConnections();
    }
    if (mongoose.connection.name === TEST_DATABASE) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    process.env.MONGO_URI = originalMongoUri;
  });

  test("consultation draft persists through HTTP, refetch, and prescription context", async () => {
    const saved = await request(
      "PATCH",
      `/api/consultations/${currentConsultationId}`,
      expectedDraft
    );
    assert.equal(
      saved.response.status,
      200,
      `Save failed: ${saved.json.message || "unexpected response"}`
    );
    for (const [field, value] of Object.entries(expectedDraft)) {
      if (field !== "vitals") assert.equal(saved.json.data[field], value);
    }

    const refetched = await request(
      "GET",
      `/api/consultations/${currentConsultationId}`
    );
    assert.equal(refetched.response.status, 200);
    for (const [field, value] of Object.entries(expectedDraft)) {
      if (field !== "vitals") assert.equal(refetched.json.data[field], value);
    }

    const createdPrescription = await request(
      "POST",
      `/api/prescriptions/consultation/${currentConsultationId}`
    );
    assert.equal(createdPrescription.response.status, 201);
    assert.equal(
      String(createdPrescription.json.data.consultationId._id),
      currentConsultationId
    );
    assert.notEqual(
      String(createdPrescription.json.data.consultationId._id),
      cancelledConsultationId
    );
    for (const field of [
      "chiefComplaint",
      "symptoms",
      "diagnosis",
      "treatmentPlan",
      "instructions",
    ]) {
      assert.equal(
        createdPrescription.json.data.consultationId[field],
        expectedDraft[field]
      );
    }
    assert.equal(
      Object.hasOwn(createdPrescription.json.data.consultationId, "privateNotes"),
      false
    );

    const prescriptionId = createdPrescription.json.data._id;
    const loadedPrescription = await request(
      "GET",
      `/api/prescriptions/${prescriptionId}`
    );
    assert.equal(loadedPrescription.response.status, 200);
    assert.equal(
      String(loadedPrescription.json.data.consultationId._id),
      currentConsultationId
    );
  });
}
