const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const Appointment = require("../models/Appointment");
const appointmentService = require("../services/appointmentService");

const appointmentId = "400000000000000000000001";
const patientId = "500000000000000000000001";
const receptionistId = "100000000000000000000001";
const adminId = "100000000000000000000002";

const originalFindById = Appointment.findById;
let appointment;

const query = (resolve) => ({
  populate() {
    return this;
  },
  then(onFulfilled, onRejected) {
    return Promise.resolve().then(resolve).then(onFulfilled, onRejected);
  },
});

const vitals = {
  systolic: 120,
  diastolic: 80,
  temperature: 36.7,
  pulse: 72,
  respiratoryRate: 16,
  oxygenSaturation: 98,
  weight: 65,
  height: 170,
};

beforeEach(() => {
  appointment = {
    _id: appointmentId,
    patientId,
    status: "checked_in",
    triage: undefined,
    save: async function save() {},
  };
  Appointment.findById = (id) =>
    query(() => (String(id) === appointmentId ? appointment : null));
});

afterEach(() => {
  Appointment.findById = originalFindById;
});

test("receptionist can record vitals after check-in without changing status", async () => {
  const result = await appointmentService.recordTriageVitals(
    appointmentId,
    { _id: receptionistId, role: "receptionist" },
    vitals
  );
  assert.equal(result.updated, false);
  assert.equal(result.appointment.triage.vitals.systolic, 120);
  assert.equal(result.appointment.triage.recordedBy, receptionistId);
  assert.ok(result.appointment.triage.recordedAt instanceof Date);
  assert.equal(appointment.status, "checked_in");
});

test("admin can record and update waiting-patient vitals", async () => {
  appointment.status = "waiting";
  appointment.triage = {
    vitals: { ...vitals, pulse: 70 },
    recordedBy: receptionistId,
    recordedAt: new Date("2026-10-15T01:00:00Z"),
  };
  const result = await appointmentService.recordTriageVitals(
    appointmentId,
    { _id: adminId, role: "admin" },
    { ...vitals, pulse: 74 }
  );
  assert.equal(result.updated, true);
  assert.equal(result.appointment.triage.vitals.pulse, 74);
  assert.equal(result.appointment.triage.recordedBy, adminId);
  assert.equal(appointment.status, "waiting");
});

test("patient cannot record triage vitals", async () => {
  await assert.rejects(
    appointmentService.recordTriageVitals(
      appointmentId,
      { _id: "100000000000000000000003", role: "patient" },
      vitals
    ),
    { statusCode: 403 }
  );
  assert.equal(appointment.triage, undefined);
});

test("doctor cannot edit nurse-recorded triage vitals", async () => {
  appointment.status = "waiting";
  appointment.triage = {
    vitals: { ...vitals },
    recordedBy: receptionistId,
    recordedAt: new Date("2026-10-16T01:00:00Z"),
  };
  await assert.rejects(
    appointmentService.recordTriageVitals(
      appointmentId,
      { _id: "100000000000000000000004", role: "doctor" },
      { ...vitals, pulse: 99 }
    ),
    { statusCode: 403 }
  );
  assert.equal(appointment.triage.vitals.pulse, 72);
  assert.equal(appointment.triage.recordedBy, receptionistId);
});

test("completed consultation appointments cannot have triage changed", async () => {
  appointment.status = "completed";
  await assert.rejects(
    appointmentService.recordTriageVitals(
      appointmentId,
      { _id: receptionistId, role: "receptionist" },
      vitals
    ),
    { statusCode: 409 }
  );
  assert.equal(appointment.triage, undefined);
});
