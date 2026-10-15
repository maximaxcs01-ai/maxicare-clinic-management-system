const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const QueueEntry = require("../models/QueueEntry");
const { sanitizeMetadata } = require("../services/auditService");
const queueService = require("../services/queueService");

const doctorId = "620000000000000000000001";
const otherDoctorId = "620000000000000000000002";
const doctorUserId = "610000000000000000000001";
const queueEntryId = "630000000000000000000001";
const appointmentId = "640000000000000000000001";
const patientId = "650000000000000000000001";
const serviceId = "660000000000000000000001";

const original = {
  startSession: mongoose.startSession,
  doctorFindOne: Doctor.findOne,
  doctorUpdateOne: Doctor.updateOne,
  queueExists: QueueEntry.exists,
  queueFindOneAndUpdate: QueueEntry.findOneAndUpdate,
  queueFindById: QueueEntry.findById,
  queueCreate: QueueEntry.create,
};

let doctorFilter;
let busyFilter;
let selectionFilter;
let selectionUpdate;
let selectionOptions;
let busy;
let selectedEntry;

const query = (value) => ({
  select() { return this; },
  session() { return this; },
  populate() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

beforeEach(() => {
  doctorFilter = null;
  busyFilter = null;
  selectionFilter = null;
  selectionUpdate = null;
  selectionOptions = null;
  busy = false;
  selectedEntry = {
    _id: queueEntryId,
    appointmentId: {
      _id: appointmentId,
      status: "waiting",
      triage: {
        vitals: { systolic: 120, diastolic: 80, pulse: 78 },
        recordedBy: { firstName: "Clinic", lastName: "Nurse", role: "receptionist" },
        recordedAt: new Date("2026-10-16T01:00:00Z"),
      },
    },
    patientId: { _id: patientId, firstName: "Own", lastName: "Patient" },
    doctorId: { _id: doctorId },
    serviceId: { _id: serviceId, name: "Consultation" },
    active: true,
    queueStatus: "called",
    joinedAt: new Date(),
  };
  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => {},
  });
  Doctor.findOne = (filter) => {
    doctorFilter = filter;
    const ownsDoctor = !filter.userId || String(filter.userId) === doctorUserId;
    return query(ownsDoctor && String(filter._id) === doctorId ? { _id: doctorId } : null);
  };
  Doctor.updateOne = async () => ({ modifiedCount: 1 });
  QueueEntry.exists = (filter) => {
    busyFilter = filter;
    return query(busy ? { _id: "busy-entry" } : null);
  };
  QueueEntry.findOneAndUpdate = (filter, update, options) => {
    selectionFilter = filter;
    selectionUpdate = update;
    selectionOptions = options;
    return Promise.resolve(selectedEntry);
  };
  QueueEntry.findById = (id) => query(String(id) === queueEntryId ? selectedEntry : null);
  QueueEntry.create = async () => { throw new Error("Call Next must not create a queue entry"); };
});

afterEach(() => {
  mongoose.startSession = original.startSession;
  Doctor.findOne = original.doctorFindOne;
  Doctor.updateOne = original.doctorUpdateOne;
  QueueEntry.exists = original.queueExists;
  QueueEntry.findOneAndUpdate = original.queueFindOneAndUpdate;
  QueueEntry.findById = original.queueFindById;
  QueueEntry.create = original.queueCreate;
});

test("Doctor calls the first waiting patient only from their own queue", async () => {
  const result = await queueService.callNextForDoctor(doctorId, {
    _id: doctorUserId,
    role: "doctor",
  });
  assert.equal(String(doctorFilter.userId), doctorUserId);
  assert.equal(String(selectionFilter.doctorId), doctorId);
  assert.equal(selectionFilter.active, true);
  assert.equal(selectionFilter.queueStatus, "waiting");
  assert.deepEqual(selectionOptions.sort, { joinedAt: 1, _id: 1 });
  assert.equal(selectionUpdate.$set.queueStatus, "called");
  assert.ok(selectionUpdate.$set.calledAt instanceof Date);
  assert.equal(result.queueStatus, "called");
});

test("Doctor cannot call another Doctor's patient", async () => {
  await assert.rejects(
    queueService.callNextForDoctor(otherDoctorId, { _id: doctorUserId, role: "doctor" }),
    { statusCode: 403 }
  );
  assert.equal(selectionFilter, null);
});

test("Call Next updates the same QueueEntry without creating another", async () => {
  await queueService.callNextForDoctor(doctorId, { _id: doctorUserId, role: "doctor" });
  assert.equal(selectedEntry._id, queueEntryId);
  assert.equal(selectionOptions.new, true);
});

test("Doctor with a Called patient cannot call another", async () => {
  busy = true;
  await assert.rejects(
    queueService.callNextForDoctor(doctorId, { _id: doctorUserId, role: "doctor" }),
    (error) => error.statusCode === 409 && /active patient/.test(error.message)
  );
  assert.deepEqual(busyFilter.$or[0], { active: true, queueStatus: "called" });
  assert.equal(selectionFilter, null);
});

test("Doctor with an In Consultation patient cannot call another", async () => {
  busy = true;
  await assert.rejects(
    queueService.callNextForDoctor(doctorId, { _id: doctorUserId, role: "doctor" }),
    { statusCode: 409 }
  );
  assert.deepEqual(busyFilter.$or[1], { queueStatus: "in_consultation" });
});

test("Admin and Receptionist retain Call Next access without Doctor ownership filtering", async () => {
  for (const role of ["admin", "receptionist"]) {
    await queueService.callNextForDoctor(doctorId, { _id: `${role}-user`, role });
    assert.equal(doctorFilter.userId, undefined);
  }
});

test("Call Next leaves recorded triage and Appointment status unchanged", async () => {
  const before = JSON.stringify(selectedEntry.appointmentId);
  const result = await queueService.callNextForDoctor(doctorId, { _id: doctorUserId, role: "doctor" });
  assert.equal(JSON.stringify(result.appointmentId), before);
  assert.equal(result.appointmentId.status, "waiting");
  assert.equal(result.appointmentId.triage.vitals.systolic, 120);
});

test("queue call audit metadata excludes clinical vitals", () => {
  const metadata = sanitizeMetadata({
    queueEntryId,
    appointmentId,
    doctorId,
    status: "called",
    vitals: { systolic: 120, diastolic: 80 },
  });
  assert.deepEqual(metadata, { queueEntryId, appointmentId, doctorId, status: "called" });
});
