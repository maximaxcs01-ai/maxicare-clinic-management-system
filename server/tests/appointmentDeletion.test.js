const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const AuditLog = require("../models/AuditLog");
const Consultation = require("../models/Consultation");
const Prescription = require("../models/Prescription");
const QueueEntry = require("../models/QueueEntry");
const service = require("../services/appointmentService");
const { validateAppointmentDeletion } = require("../validators/appointmentValidator");

const ids = {
  admin: "100000000000000000000001",
  appointment: "400000000000000000000001",
  patient: "500000000000000000000001",
  doctor: "600000000000000000000001",
  consultation: "700000000000000000000001",
  prescription: "800000000000000000000001",
  queue: "300000000000000000000001",
};

const originals = {
  startSession: mongoose.startSession,
  appointmentFindById: Appointment.findById,
  appointmentDeleteOne: Appointment.deleteOne,
  consultationFind: Consultation.find,
  consultationDeleteMany: Consultation.deleteMany,
  prescriptionFind: Prescription.find,
  prescriptionDeleteMany: Prescription.deleteMany,
  queueDeleteMany: QueueEntry.deleteMany,
  auditCreate: AuditLog.create,
};

const query = (resolve) => ({
  select() {
    return this;
  },
  session() {
    return this;
  },
  then(resolveResult, reject) {
    return Promise.resolve().then(resolve).then(resolveResult, reject);
  },
});

let appointment;
let consultations;
let prescriptions;
let queueEntries;
let audits;
let deleted;

beforeEach(() => {
  appointment = {
    _id: ids.appointment,
    patientId: ids.patient,
    status: "waiting",
  };
  consultations = [];
  prescriptions = [];
  queueEntries = [{ _id: ids.queue, appointmentId: ids.appointment }];
  audits = [];
  deleted = { appointment: false };

  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  Appointment.findById = (id) =>
    query(() => (String(id) === ids.appointment && !deleted.appointment ? appointment : null));
  Appointment.deleteOne = (filter) => ({
    session() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        if (String(filter._id) === ids.appointment) {
          deleted.appointment = true;
        }
        return { deletedCount: deleted.appointment ? 1 : 0 };
      }).then(resolve, reject);
    },
  });
  Consultation.find = (filter) =>
    query(() =>
      consultations.filter(
        (item) => String(item.appointmentId) === String(filter.appointmentId)
      )
    );
  Consultation.deleteMany = (filter) => ({
    session() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        const idsToDelete = new Set(filter._id.$in.map(String));
        const before = consultations.length;
        consultations = consultations.filter(
          (item) =>
            !idsToDelete.has(String(item._id)) || item.status !== "cancelled"
        );
        return { deletedCount: before - consultations.length };
      }).then(resolve, reject);
    },
  });
  Prescription.find = (filter) =>
    query(() =>
      prescriptions.filter(
        (item) =>
          String(item.appointmentId) === String(ids.appointment) ||
          consultations.some(
            (consultation) =>
              String(consultation._id) === String(item.consultationId)
          )
      )
    );
  Prescription.deleteMany = (filter) => ({
    session() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        const idsToDelete = new Set(filter._id.$in.map(String));
        const before = prescriptions.length;
        prescriptions = prescriptions.filter(
          (item) =>
            !idsToDelete.has(String(item._id)) || item.status !== "draft"
        );
        return { deletedCount: before - prescriptions.length };
      }).then(resolve, reject);
    },
  });
  QueueEntry.deleteMany = (filter) => ({
    session() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        const before = queueEntries.length;
        queueEntries = queueEntries.filter(
          (entry) =>
            String(entry.appointmentId) !== String(filter.appointmentId)
        );
        return { deletedCount: before - queueEntries.length };
      }).then(resolve, reject);
    },
  });
  AuditLog.create = async (entries) => {
    const created = Array.isArray(entries) ? entries : [entries];
    audits.push(...created);
    return created;
  };
});

afterEach(() => {
  mongoose.startSession = originals.startSession;
  Appointment.findById = originals.appointmentFindById;
  Appointment.deleteOne = originals.appointmentDeleteOne;
  Consultation.find = originals.consultationFind;
  Consultation.deleteMany = originals.consultationDeleteMany;
  Prescription.find = originals.prescriptionFind;
  Prescription.deleteMany = originals.prescriptionDeleteMany;
  QueueEntry.deleteMany = originals.queueDeleteMany;
  AuditLog.create = originals.auditCreate;
});

const admin = { _id: ids.admin, role: "admin" };
const request = { ip: "127.0.0.1", get: () => "test-agent" };

test("Admin deletes a waiting appointment and its non-final linked records with durable audit", async () => {
  consultations.push({
    _id: ids.consultation,
    appointmentId: ids.appointment,
    status: "cancelled",
  });
  prescriptions.push({
    _id: ids.prescription,
    appointmentId: ids.appointment,
    consultationId: ids.consultation,
    status: "draft",
  });

  const result = await service.deleteAppointment(
    ids.appointment,
    admin,
    "Duplicate test appointment",
    request
  );
  assert.equal(result.deleted, true);
  assert.equal(deleted.appointment, true);
  assert.equal(queueEntries.length, 0);
  assert.equal(consultations.length, 0);
  assert.equal(prescriptions.length, 0);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "appointment.deleted");
  assert.equal(audits[0].entityId, ids.appointment);
  assert.equal(audits[0].metadata.previousStatus, "waiting");
  assert.equal(audits[0].metadata.reason, "Duplicate test appointment");
});

test("Admin deletes a cancelled appointment without requiring a consultation", async () => {
  appointment.status = "cancelled";
  const result = await service.deleteAppointment(
    ids.appointment,
    admin,
    "Erroneous cancellation"
  );
  assert.equal(result.previousStatus, "cancelled");
  assert.equal(deleted.appointment, true);
  assert.equal(queueEntries.length, 0);
});

test("only Admin can delete appointments", async () => {
  for (const role of ["receptionist", "doctor", "patient"]) {
    await assert.rejects(
      service.deleteAppointment(
        ids.appointment,
        { _id: ids.admin, role },
        "Not allowed"
      ),
      { statusCode: 403 }
    );
  }
  assert.equal(deleted.appointment, false);
});

test("in-consultation appointments require consultation resolution first", async () => {
  appointment.status = "in_consultation";
  await assert.rejects(
    service.deleteAppointment(ids.appointment, admin, "Cleanup"),
    { statusCode: 409 }
  );
  assert.equal(deleted.appointment, false);
  assert.equal(queueEntries.length, 1);
});

test("an in-progress consultation blocks deleting a stale waiting appointment", async () => {
  consultations.push({
    _id: ids.consultation,
    appointmentId: ids.appointment,
    status: "in_progress",
  });
  await assert.rejects(
    service.deleteAppointment(ids.appointment, admin, "Cleanup"),
    { statusCode: 409 }
  );
  assert.equal(deleted.appointment, false);
  assert.equal(consultations.length, 1);
});

test("completed appointment and completed consultation history cannot be deleted", async () => {
  appointment.status = "completed";
  await assert.rejects(
    service.deleteAppointment(ids.appointment, admin, "Test cleanup"),
    { statusCode: 409 }
  );
  appointment.status = "waiting";
  consultations.push({
    _id: ids.consultation,
    appointmentId: ids.appointment,
    status: "completed",
  });
  await assert.rejects(
    service.deleteAppointment(ids.appointment, admin, "Test cleanup"),
    { statusCode: 409 }
  );
  assert.equal(deleted.appointment, false);
});

test("an issued prescription blocks appointment and linked record cleanup", async () => {
  consultations.push({
    _id: ids.consultation,
    appointmentId: ids.appointment,
    status: "cancelled",
  });
  prescriptions.push({
    _id: ids.prescription,
    appointmentId: ids.appointment,
    consultationId: ids.consultation,
    status: "issued",
  });
  await assert.rejects(
    service.deleteAppointment(ids.appointment, admin, "Duplicate"),
    { statusCode: 409 }
  );
  assert.equal(deleted.appointment, false);
  assert.equal(consultations.length, 1);
  assert.equal(prescriptions[0].status, "issued");
});

test("appointment deletion requires a trimmed bounded reason and no extra fields", () => {
  const validate = (body) => {
    const req = { body };
    let statusCode;
    let response;
    let advanced = false;
    validateAppointmentDeletion(
      req,
      {
        status(code) {
          statusCode = code;
          return this;
        },
        json(value) {
          response = value;
        },
      },
      () => {
        advanced = true;
      }
    );
    return { req, statusCode, response, advanced };
  };
  assert.equal(validate({ reason: " " }).statusCode, 400);
  assert.equal(validate({ reason: "valid", status: "deleted" }).statusCode, 400);
  const valid = validate({ reason: " Duplicate test record " });
  assert.equal(valid.advanced, true);
  assert.equal(valid.req.appointmentDeletionReason, "Duplicate test record");
});
