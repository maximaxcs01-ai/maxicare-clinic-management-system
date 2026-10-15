const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Prescription = require("../models/Prescription");
const QueueEntry = require("../models/QueueEntry");
const AuditLog = require("../models/AuditLog");
const service = require("../services/consultationService");
const patientRecordsService = require("../services/patientRecordsService");
const {
  validateConsultationDraft,
  validateConsultationReason,
} = require("../validators/consultationValidator");
const { authorize } = require("../middleware/authMiddleware");

const ids = {
  userA: "100000000000000000000001",
  userB: "100000000000000000000002",
  doctorA: "200000000000000000000001",
  doctorB: "200000000000000000000002",
  queue: "300000000000000000000001",
  appointment: "400000000000000000000001",
  patient: "500000000000000000000001",
  service: "600000000000000000000001",
  consultation: "700000000000000000000001",
};

const originalMethods = {
  doctorFindOne: Doctor.findOne,
  queueFindOne: QueueEntry.findOne,
  appointmentFindOne: Appointment.findOne,
  consultationCreate: Consultation.create,
  consultationExists: Consultation.exists,
  consultationFindOne: Consultation.findOne,
  consultationFind: Consultation.find,
  consultationFindOneAndUpdate: Consultation.findOneAndUpdate,
  consultationDeleteOne: Consultation.deleteOne,
  prescriptionExists: Prescription.exists,
  prescriptionFindOne: Prescription.findOne,
  prescriptionDeleteOne: Prescription.deleteOne,
  queueExists: QueueEntry.exists,
  appointmentFindById: Appointment.findById,
  appointmentFind: Appointment.find,
  patientFindOne: Patient.findOne,
  prescriptionFind: Prescription.find,
  auditCreate: AuditLog.create,
  startSession: require("mongoose").startSession,
};

const query = (resolve) => ({
  select() {
    return this;
  },
  session() {
    return this;
  },
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  then(onFulfilled, onRejected) {
    return Promise.resolve().then(resolve).then(onFulfilled, onRejected);
  },
});

const matches = (record, filter) =>
  record &&
  Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && "$in" in value) {
      return value.$in.some((item) => String(item) === String(record[key]));
    }
    if (value && typeof value === "object" && "$ne" in value) {
      return String(record[key]) !== String(value.$ne);
    }
    return String(record[key]) === String(value);
  });

let appointment;
let queueEntry;
let consultations;
let prescriptions;
let queueEntries;
let auditLogs;

beforeEach(() => {
  appointment = {
    _id: ids.appointment,
    patientId: ids.patient,
    doctorId: ids.doctorA,
    serviceId: ids.service,
    bookingType: "walk_in",
    status: "waiting",
    triage: {
      vitals: { systolic: 120, diastolic: 80 },
      recordedBy: ids.userB,
      recordedAt: new Date("2026-10-15T01:00:00Z"),
    },
    statusHistory: [],
    save: async function save() {},
  };
  queueEntry = {
    _id: ids.queue,
    appointmentId: ids.appointment,
    patientId: ids.patient,
    doctorId: ids.doctorA,
    serviceId: ids.service,
    queueStatus: "called",
    active: true,
    save: async function save() {},
  };
  consultations = [];
  prescriptions = [];
  queueEntries = [queueEntry];
  auditLogs = [];

  Doctor.findOne = (filter) =>
    query(() => {
      if (String(filter.userId) === ids.userA) return { _id: ids.doctorA };
      if (String(filter.userId) === ids.userB) return { _id: ids.doctorB };
      return null;
    });
  QueueEntry.findOne = (filter) =>
    query(() => (matches(queueEntry, filter) ? queueEntry : null));
  Appointment.findOne = (filter) =>
    query(() => (matches(appointment, filter) ? appointment : null));
  Consultation.exists = (filter) =>
    query(() =>
      consultations.some((consultation) => matches(consultation, filter))
        ? { _id: ids.consultation }
        : null
    );
  Consultation.deleteOne = (filter) => ({
    session() {
      return this;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve().then(() => {
        const index = consultations.findIndex((item) => matches(item, filter));
        if (index < 0) return { deletedCount: 0 };
        consultations.splice(index, 1);
        return { deletedCount: 1 };
      }).then(onFulfilled, onRejected);
    },
  });
  Consultation.findOne = (filter) =>
    query(
      () =>
        consultations.find((consultation) => matches(consultation, filter)) ||
        null
    );
  Consultation.find = (filter) =>
    query(() => consultations.filter((item) => matches(item, filter)));
  Consultation.create = async ([values]) => {
    const consultation = {
      ...values,
      _id:
        consultations.length === 0
          ? ids.consultation
          : "700000000000000000000002",
      vitals: values.vitals || {},
      save: async function save() {},
    };
    consultations.push(consultation);
    return [consultation];
  };
  Consultation.findOneAndUpdate = (filter, update) =>
    query(() => {
      const consultation = consultations.find((item) => matches(item, filter));
      if (!consultation) return null;
      Object.assign(consultation, update.$set);
      return consultation;
    });
  Prescription.exists = (filter) =>
    query(() => {
      const prescription = prescriptions.find((item) => matches(item, filter));
      return prescription ? { _id: prescription._id } : null;
    });
  Prescription.findOne = (filter) =>
    query(() => prescriptions.find((item) => matches(item, filter)) || null);
  Prescription.find = (filter) =>
    query(() => prescriptions.filter((item) => matches(item, filter)));
  Prescription.deleteOne = (filter) => ({
    session() {
      return this;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve().then(() => {
        const index = prescriptions.findIndex((item) => matches(item, filter));
        if (index < 0) return { deletedCount: 0 };
        prescriptions.splice(index, 1);
        return { deletedCount: 1 };
      }).then(onFulfilled, onRejected);
    },
  });
  QueueEntry.exists = (filter) =>
    query(() =>
      queueEntries.some((entry) => matches(entry, filter))
        ? { _id: ids.queue }
        : null
    );
  Appointment.findById = (id) => query(() =>
    String(id) === String(appointment._id) ? appointment : null
  );
  Appointment.find = () => query(() => []);
  Patient.findOne = () => query(() => ({ _id: ids.patient }));
  AuditLog.create = async (entries) => {
    const created = Array.isArray(entries) ? entries : [entries];
    auditLogs.push(...created);
    return created;
  };
  require("mongoose").startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
});

afterEach(() => {
  Doctor.findOne = originalMethods.doctorFindOne;
  QueueEntry.findOne = originalMethods.queueFindOne;
  Appointment.findOne = originalMethods.appointmentFindOne;
  Consultation.create = originalMethods.consultationCreate;
  Consultation.exists = originalMethods.consultationExists;
  Consultation.findOne = originalMethods.consultationFindOne;
  Consultation.find = originalMethods.consultationFind;
  Consultation.findOneAndUpdate = originalMethods.consultationFindOneAndUpdate;
  Consultation.deleteOne = originalMethods.consultationDeleteOne;
  Prescription.exists = originalMethods.prescriptionExists;
  Prescription.findOne = originalMethods.prescriptionFindOne;
  Prescription.deleteOne = originalMethods.prescriptionDeleteOne;
  QueueEntry.exists = originalMethods.queueExists;
  Appointment.findById = originalMethods.appointmentFindById;
  Appointment.find = originalMethods.appointmentFind;
  Patient.findOne = originalMethods.patientFindOne;
  Prescription.find = originalMethods.prescriptionFind;
  AuditLog.create = originalMethods.auditCreate;
  require("mongoose").startSession = originalMethods.startSession;
});

const doctorUser = {
  _id: ids.userA,
  role: "doctor",
};

const completeDraft = {
  chiefComplaint: "Cough",
  symptoms: "Dry cough",
  vitals: {},
  diagnosis: "Upper respiratory infection",
  treatmentPlan: "Rest",
  instructions: "",
  privateNotes: "Follow up if symptoms worsen",
};

test("starts a called walk-in, then completes appointment and queue atomically", async () => {
  const started = await service.startConsultation(ids.queue, doctorUser);
  assert.equal(started.status, "in_progress");
  assert.equal(appointment.status, "in_consultation");
  assert.equal(appointment.statusHistory.at(-1).status, "in_consultation");
  assert.equal(queueEntry.queueStatus, "in_consultation");
  assert.equal(queueEntry.active, false);

  await service.markNoPrescriptionNeeded(ids.consultation, doctorUser);

  const completed = await service.completeConsultation(
    ids.consultation,
    doctorUser,
    completeDraft
  );
  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt instanceof Date);
  assert.equal(appointment.status, "completed");
  assert.equal(appointment.statusHistory.at(-1).status, "completed");
  assert.equal(queueEntry.queueStatus, "completed");
  assert.equal(queueEntry.active, false);
});

test("copies recorded triage vitals into the consultation snapshot", async () => {
  appointment.triage = {
    vitals: { systolic: 120, diastolic: 80, temperature: 36.7 },
    recordedBy: ids.userB,
    recordedAt: new Date("2026-10-15T01:00:00Z"),
  };

  const started = await service.startConsultation(ids.queue, doctorUser);
  assert.equal(started.vitals.systolic, 120);
  assert.equal(started.vitals.diastolic, 80);
  assert.equal(started.triageRecordedBy, ids.userB);
  assert.equal(started.triageRecordedAt, appointment.triage.recordedAt);
});

test("blocks completion while the prescription decision is pending", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  await assert.rejects(
    service.completeConsultation(ids.consultation, doctorUser, completeDraft),
    {
      statusCode: 400,
      message:
        "Complete the prescription decision before completing the consultation.",
    }
  );
  assert.equal(appointment.status, "in_consultation");
  assert.equal(queueEntry.queueStatus, "in_consultation");
});

test("a draft prescription alone does not allow completion", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  prescriptions.push({
    _id: "800000000000000000000001",
    consultationId: ids.consultation,
    doctorId: ids.doctorA,
    status: "draft",
  });
  await assert.rejects(
    service.completeConsultation(ids.consultation, doctorUser, completeDraft),
    { statusCode: 400 }
  );
});

test("an issued prescription allows completion", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  prescriptions.push({
    _id: "800000000000000000000001",
    consultationId: ids.consultation,
    doctorId: ids.doctorA,
    status: "issued",
  });
  const completed = await service.completeConsultation(
    ids.consultation,
    doctorUser,
    completeDraft
  );
  assert.equal(completed.status, "completed");
});

test("an explicit no-prescription-needed decision allows completion", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  await service.markNoPrescriptionNeeded(ids.consultation, doctorUser);
  const completed = await service.completeConsultation(
    ids.consultation,
    doctorUser,
    completeDraft
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.prescriptionDecision, "none_required");
});

test("starts a called scheduled appointment using the same workflow", async () => {
  appointment.bookingType = "scheduled";
  const started = await service.startConsultation(ids.queue, doctorUser);
  assert.equal(started.appointmentId, ids.appointment);
  assert.equal(appointment.status, "in_consultation");
  assert.equal(queueEntry.queueStatus, "in_consultation");
});

test("blocks another doctor and requires a called queue entry", async () => {
  await assert.rejects(
    service.startConsultation(ids.queue, { _id: ids.userB, role: "doctor" }),
    { statusCode: 409 }
  );
  queueEntry.queueStatus = "waiting";
  await assert.rejects(service.startConsultation(ids.queue, doctorUser), {
    statusCode: 409,
  });
  assert.equal(consultations.length, 0);
});

test("blocks duplicate consultations for the appointment", async () => {
  consultations.push({
    _id: ids.consultation,
    appointmentId: ids.appointment,
    doctorId: ids.doctorA,
    status: "in_progress",
  });
  await assert.rejects(
    service.startConsultation(ids.queue, doctorUser),
    { statusCode: 409 }
  );
  assert.equal(appointment.status, "waiting");
  assert.equal(queueEntry.queueStatus, "called");
});

test("saves drafts for the owner and protects private notes from other doctors", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  const draft = { ...completeDraft, privateNotes: "Doctor-only note" };
  const saved = await service.saveDraft(ids.consultation, doctorUser, draft);
  assert.equal(saved.privateNotes, "Doctor-only note");
  assert.equal(appointment.status, "in_consultation");

  await assert.rejects(
    service.getConsultation(ids.consultation, {
      _id: ids.userB,
      role: "doctor",
    }),
    { statusCode: 404 }
  );
});

test("completed consultations cannot be edited", async () => {
  consultations.push({
    _id: ids.consultation,
    doctorId: ids.doctorA,
    status: "completed",
  });
  await assert.rejects(
    service.saveDraft(ids.consultation, doctorUser, completeDraft),
    { statusCode: 409 }
  );
});

test("completion validator requires diagnosis and a plan or instructions", () => {
  const runValidator = (body) => {
    const req = { body };
    let statusCode;
    let responseBody;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
      },
    };
    let advanced = false;
    validateConsultationDraft(true)(req, res, () => {
      advanced = true;
    });
    return { statusCode, responseBody, advanced };
  };

  const invalid = runValidator({ diagnosis: "", treatmentPlan: "" });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.advanced, false);

  const valid = runValidator({
    diagnosis: "Diagnosis",
    instructions: "Instructions",
  });
  assert.equal(valid.advanced, true);
  assert.equal(valid.responseBody, undefined);
});

test("consultation authorization rejects patient and receptionist roles", () => {
  const doctorOnly = authorize("doctor");
  for (const role of ["patient", "receptionist", "admin"]) {
    let statusCode;
    let advanced = false;
    doctorOnly(
      { user: { role } },
      {
        status(code) {
          statusCode = code;
          return this;
        },
        json() {},
      },
      () => {
        advanced = true;
      }
    );
    assert.equal(statusCode, 403);
    assert.equal(advanced, false);
  }

  let allowed = false;
  doctorOnly(
    { user: { role: "doctor" } },
    {},
    () => {
      allowed = true;
    }
  );
  assert.equal(allowed, true);
});

const operationalRequest = {
  ip: "127.0.0.1",
  get: () => "test-agent",
};

test("receptionist cancellation returns the appointment and existing queue entry to waiting", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  const originalTriage = structuredClone(appointment.triage);
  const result = await service.cancelConsultation(
    ids.consultation,
    { _id: ids.userB, role: "receptionist" },
    "Patient requires additional preparation",
    operationalRequest
  );

  assert.equal(result.status, "cancelled");
  assert.equal(result.appointmentStatus, "waiting");
  assert.equal(result.queueStatus, "waiting");
  assert.equal(consultations[0].cancelledBy, ids.userB);
  assert.equal(consultations[0].cancellationReason, "Patient requires additional preparation");
  assert.equal(appointment.status, "waiting");
  assert.deepEqual(appointment.triage, originalTriage);
  assert.equal(queueEntry.queueStatus, "waiting");
  assert.equal(queueEntry.active, true);
  assert.equal(queueEntry.calledAt, null);
  assert.equal(queueEntries.filter((entry) => entry.active).length, 1);
  assert.equal(auditLogs[0].action, "consultation.cancelled");
  assert.equal(auditLogs[0].metadata.appointmentStatus, "waiting");
  assert.equal(auditLogs[0].metadata.queueStatus, "waiting");
});

test("admin can cancel an in-progress consultation", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  const result = await service.cancelConsultation(
    ids.consultation,
    { _id: ids.userB, role: "admin" },
    "Operational interruption"
  );
  assert.equal(result.status, "cancelled");
  assert.equal(appointment.status, "waiting");
  assert.equal(queueEntry.queueStatus, "waiting");
});

test("doctors and patients cannot cancel consultations", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  for (const role of ["doctor", "patient"]) {
    await assert.rejects(
      service.cancelConsultation(
        ids.consultation,
        { _id: ids.userA, role },
        "Unauthorized"
      ),
      { statusCode: 403 }
    );
  }
  assert.equal(consultations[0].status, "in_progress");
  assert.equal(appointment.status, "in_consultation");
});

test("cancellation blocks a second active queue entry for the patient", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  queueEntries.push({
    _id: "300000000000000000000002",
    patientId: ids.patient,
    active: true,
    queueStatus: "waiting",
  });
  await assert.rejects(
    service.cancelConsultation(
      ids.consultation,
      { _id: ids.userB, role: "admin" },
      "Retry"
    ),
    { statusCode: 409 }
  );
  assert.equal(consultations[0].status, "in_progress");
  assert.equal(queueEntry.active, false);
});

test("admin deletes an eligible cancelled consultation and records durable audit", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  await service.cancelConsultation(
    ids.consultation,
    { _id: ids.userB, role: "admin" },
    "Cancelled in error",
    operationalRequest
  );
  prescriptions.push({
    _id: "800000000000000000000001",
    consultationId: ids.consultation,
    status: "draft",
  });

  const result = await service.deleteConsultation(
    ids.consultation,
    { _id: ids.userB, role: "admin" },
    "Duplicate test record",
    operationalRequest
  );
  assert.equal(result.deleted, true);
  assert.equal(consultations.length, 0);
  assert.equal(prescriptions.length, 0);
  assert.equal(appointment.status, "waiting");
  assert.equal(queueEntry.active, true);
  assert.equal(auditLogs.at(-1).action, "consultation.deleted");
  assert.equal(auditLogs.at(-1).entityId, ids.consultation);
  assert.equal(auditLogs.at(-1).metadata.reason, "Duplicate test record");
});

test("admin deletes an eligible erroneous in-progress consultation and restores waiting state", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  const result = await service.deleteConsultation(
    ids.consultation,
    { _id: ids.userB, role: "admin" },
    "Started against the wrong record",
    operationalRequest
  );

  assert.equal(result.deleted, true);
  assert.equal(consultations.length, 0);
  assert.equal(appointment.status, "waiting");
  assert.equal(queueEntry.queueStatus, "waiting");
  assert.equal(queueEntry.active, true);
  assert.equal(auditLogs.at(-1).action, "consultation.deleted");
});

test("receptionists and doctors cannot delete consultations", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  for (const role of ["receptionist", "doctor"]) {
    await assert.rejects(
      service.deleteConsultation(
        ids.consultation,
        { _id: ids.userB, role },
        "Unauthorized"
      ),
      { statusCode: 403 }
    );
  }
  assert.equal(consultations.length, 1);
});

test("admin cannot delete completed consultation history", async () => {
  appointment.status = "completed";
  consultations.push({
    _id: ids.consultation,
    appointmentId: ids.appointment,
    patientId: ids.patient,
    status: "completed",
  });
  await assert.rejects(
    service.deleteConsultation(
      ids.consultation,
      { _id: ids.userB, role: "admin" },
      "Erroneous"
    ),
    {
      statusCode: 409,
      message:
        "This consultation cannot be deleted because it is part of finalized medical history.",
    }
  );
  assert.equal(consultations.length, 1);
});

test("admin cannot delete a consultation with an issued prescription", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  await service.cancelConsultation(
    ids.consultation,
    { _id: ids.userB, role: "admin" },
    "Test cancellation"
  );
  prescriptions.push({
    _id: "800000000000000000000002",
    consultationId: ids.consultation,
    status: "issued",
  });
  await assert.rejects(
    service.deleteConsultation(
      ids.consultation,
      { _id: ids.userB, role: "admin" },
      "Erroneous"
    ),
    { statusCode: 409 }
  );
  assert.equal(consultations[0].status, "cancelled");
});

test("a new consultation can start after cancellation while the cancelled record remains", async () => {
  await service.startConsultation(ids.queue, doctorUser);
  await service.cancelConsultation(
    ids.consultation,
    { _id: ids.userB, role: "receptionist" },
    "Ready to resume"
  );
  queueEntry.queueStatus = "called";
  const restarted = await service.startConsultation(ids.queue, doctorUser);

  assert.equal(consultations.length, 2);
  assert.equal(consultations[0].status, "cancelled");
  assert.equal(restarted.status, "in_progress");
  assert.equal(restarted.triageRecordedBy, appointment.triage.recordedBy);
  assert.equal(appointment.status, "in_consultation");
  assert.equal(queueEntry.queueStatus, "in_consultation");
});

test("cancelled consultations remain excluded from patient completed history", async () => {
  consultations.push(
    {
      _id: ids.consultation,
      patientId: ids.patient,
      status: "cancelled",
    },
    {
      _id: "700000000000000000000002",
      patientId: ids.patient,
      status: "completed",
    }
  );

  const history = await patientRecordsService.getPatientHistory({
    _id: ids.userA,
    role: "patient",
  });
  assert.deepEqual(
    history.consultations.map((item) => item.status),
    ["completed"]
  );
});

test("cancellation and deletion validators require a bounded reason", () => {
  const runValidator = (body) => {
    const req = { body };
    let statusCode;
    let responseBody;
    let advanced = false;
    validateConsultationReason(
      req,
      {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseBody = data;
        },
      },
      () => {
        advanced = true;
      }
    );
    return { req, statusCode, responseBody, advanced };
  };

  assert.equal(runValidator({ reason: "  " }).statusCode, 400);
  assert.equal(runValidator({ reason: "Valid reason", extra: "not allowed" }).statusCode, 400);
  const valid = runValidator({ reason: "  Duplicate record  " });
  assert.equal(valid.advanced, true);
  assert.equal(valid.req.consultationReason, "Duplicate record");
});
