const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const QueueEntry = require("../models/QueueEntry");
const service = require("../services/consultationService");
const { validateConsultationDraft } = require("../validators/consultationValidator");
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
  consultationFindOneAndUpdate: Consultation.findOneAndUpdate,
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
  Object.entries(filter).every(([key, value]) => String(record[key]) === String(value));

let appointment;
let queueEntry;
let consultations;

beforeEach(() => {
  appointment = {
    _id: ids.appointment,
    patientId: ids.patient,
    doctorId: ids.doctorA,
    serviceId: ids.service,
    bookingType: "walk_in",
    status: "waiting",
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
  Consultation.findOne = (filter) =>
    query(
      () =>
        consultations.find((consultation) => matches(consultation, filter)) ||
        null
    );
  Consultation.create = async ([values]) => {
    const consultation = {
      ...values,
      _id: ids.consultation,
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
  Consultation.findOneAndUpdate = originalMethods.consultationFindOneAndUpdate;
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
