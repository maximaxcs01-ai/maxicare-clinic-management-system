const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Prescription = require("../models/Prescription");
const service = require("../services/patientRecordsService");
const patientService = require("../services/patientService");

const ids = {
  user: "610000000000000000000001",
  doctor: "620000000000000000000001",
  patient: "630000000000000000000001",
  otherPatient: "630000000000000000000002",
  consultation: "640000000000000000000001",
  otherConsultation: "640000000000000000000002",
  prescription: "650000000000000000000001",
};

const original = {
  appointmentFind: Appointment.find,
  appointmentExists: Appointment.exists,
  appointmentDistinct: Appointment.distinct,
  consultationFind: Consultation.find,
  consultationFindOne: Consultation.findOne,
  doctorFindOne: Doctor.findOne,
  patientFindOne: Patient.findOne,
  patientFindById: Patient.findById,
  patientFindByIdAndDelete: Patient.findByIdAndDelete,
  consultationExists: Consultation.exists,
  prescriptionFind: Prescription.find,
  prescriptionFindOne: Prescription.findOne,
};

const makeQuery = (resolver, selectCalls = [], populateCalls = []) => {
  let selectedFields;
  return {
  select(fields) {
    selectedFields = fields;
    selectCalls.push(fields);
    return this;
  },
  populate(path, projection) {
    populateCalls.push([path, projection]);
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
  then(resolve, reject) {
    return Promise.resolve().then(resolver).then(resolve, reject);
  },
  getSelectedFields() {
    return selectedFields;
  },
  };
};

const patient = {
  _id: ids.patient,
  patientNumber: "P-0001",
  firstName: "Test",
  lastName: "Patient",
};

const patientUser = { _id: ids.user, role: "patient" };
const doctorUser = { _id: ids.user, role: "doctor" };

let consultationQueries;
let prescriptionQueries;
let projectedFields;
let prescriptionPopulations;

beforeEach(() => {
  consultationQueries = [];
  prescriptionQueries = [];
  projectedFields = [];
  prescriptionPopulations = [];
  Patient.findOne = () => makeQuery(() => patient, projectedFields);
  Patient.findById = () => makeQuery(() => patient, projectedFields);
  Patient.findByIdAndDelete = async () => {
    throw new Error("Patient with history must not be deleted");
  };
  Doctor.findOne = () => makeQuery(() => ({ _id: ids.doctor }));
  Appointment.find = () => makeQuery(() => [], projectedFields);
  Appointment.exists = () => makeQuery(() => ({ _id: "appointment" }));
  Consultation.exists = () => makeQuery(() => null);
  Appointment.distinct = async () => [ids.patient];
  Consultation.findOne = (filter) => {
    let query;
    query = makeQuery(() => {
      consultationQueries.push({
        filter,
        projection: query.getSelectedFields(),
      });
      if (
        String(filter.patientId) !== ids.patient ||
        String(filter._id) !== ids.consultation ||
        filter.status !== "completed"
      ) {
        return null;
      }
      return {
        _id: ids.consultation,
        patientId: ids.patient,
        status: "completed",
        diagnosis: "Completed diagnosis",
      };
    }, projectedFields);
    return query;
  };
  Consultation.find = (filter) => {
    let query;
    query = makeQuery(() => {
      consultationQueries.push({
        filter,
        projection: query.getSelectedFields(),
      });
      if (filter.status !== "completed") return [];
      if (filter.doctorId && typeof filter.doctorId === "object") {
        return [
          {
            _id: ids.otherConsultation,
            patientId: ids.patient,
            doctorId: "different-doctor",
            status: "completed",
            completedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ];
      }
      return [
        {
          _id: ids.consultation,
          patientId: ids.patient,
          doctorId: ids.doctor,
          status: "completed",
          completedAt: new Date("2026-02-01T00:00:00Z"),
          ...(filter.doctorId
            ? { privateNotes: "Only this doctor may see this note" }
            : {}),
        },
      ];
    }, projectedFields);
    return query;
  };
  Prescription.find = (filter) => {
    const query = makeQuery(() => {
      prescriptionQueries.push(filter);
      return filter.status === "issued"
        ? [
            {
              _id: ids.prescription,
              consultationId: ids.consultation,
              patientId: ids.patient,
              status: "issued",
            },
          ]
        : [];
    }, projectedFields, prescriptionPopulations);
    return query;
  };
  Prescription.findOne = (filter) =>
    makeQuery(
      () =>
        filter.patientId === ids.patient && filter.status === "issued"
          ? {
              _id: ids.prescription,
              consultationId: ids.consultation,
              status: "issued",
            }
          : null,
      projectedFields,
      prescriptionPopulations
    );
});

afterEach(() => {
  Appointment.find = original.appointmentFind;
  Appointment.exists = original.appointmentExists;
  Appointment.distinct = original.appointmentDistinct;
  Consultation.find = original.consultationFind;
  Consultation.findOne = original.consultationFindOne;
  Doctor.findOne = original.doctorFindOne;
  Patient.findOne = original.patientFindOne;
  Patient.findById = original.patientFindById;
  Patient.findByIdAndDelete = original.patientFindByIdAndDelete;
  Consultation.exists = original.consultationExists;
  Prescription.find = original.prescriptionFind;
  Prescription.findOne = original.prescriptionFindOne;
});

test("patient history includes completed consultations and issued prescriptions only", async () => {
  const result = await service.getPatientHistory(patientUser);
  assert.ok(consultationQueries.every(({ filter }) => filter.status === "completed"));
  assert.ok(prescriptionQueries.every(({ status }) => status === "issued"));
  assert.equal(result.consultations.length, 1);
  assert.equal(result.prescriptions.length, 1);
  assert.equal(
    Object.hasOwn(result.consultations[0], "privateNotes"),
    false
  );
  assert.equal(projectedFields.some((fields) => fields?.includes("privateNotes")), false);
  const consultationPopulate = prescriptionPopulations.find(
    ([path]) => path?.path === "consultationId"
  );
  assert.ok(consultationPopulate);
  assert.ok(consultationPopulate[0].select.includes("diagnosis"));
  assert.ok(consultationPopulate[0].select.includes("treatmentPlan"));
  assert.ok(consultationPopulate[0].select.includes("instructions"));
  assert.equal(consultationPopulate[0].select.includes("privateNotes"), false);
});

test("patient history links visit summaries only to completed appointments", async () => {
  const completedAppointment = {
    _id: "660000000000000000000001",
    patientId: ids.patient,
    status: "completed",
  };
  const cancelledAppointment = {
    _id: "660000000000000000000002",
    patientId: ids.patient,
    status: "cancelled",
  };
  Appointment.find = () =>
    makeQuery(() => [completedAppointment, cancelledAppointment], projectedFields);
  Consultation.find = (filter) => {
    const isLinkLookup = Boolean(filter.appointmentId?.$in);
    return makeQuery(
      () =>
        isLinkLookup
          ? [
              {
                _id: ids.consultation,
                appointmentId: completedAppointment._id,
                patientId: ids.patient,
                status: "completed",
              },
            ]
          : [],
      projectedFields
    );
  };

  const result = await service.getPatientHistory(patientUser);

  assert.equal(String(result.appointments[0].consultationId), ids.consultation);
  assert.equal(result.appointments[1].consultationId, undefined);
});

test("patient consultation detail is resolved through the authenticated Patient", async () => {
  const result = await service.getOwnCompletedConsultation(
    ids.consultation,
    patientUser
  );
  assert.equal(result.consultation.diagnosis, "Completed diagnosis");
  assert.equal(result.prescription.status, "issued");
  assert.deepEqual(consultationQueries[0].filter, {
    _id: ids.consultation,
    patientId: ids.patient,
    status: "completed",
  });
  assert.ok(projectedFields.some((fields) => fields?.includes("prescriptionDecision")));
  assert.equal(projectedFields.some((fields) => fields?.includes("privateNotes")), false);
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "privateNotes",
    "publicId",
    "password",
    "tokenVersion",
    "createdBy",
    "updatedBy",
    "patientId",
    "consultationId",
    '"_id"',
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("patient cannot fetch another patient's consultation", async () => {
  Consultation.findOne = (filter) =>
    makeQuery(() => {
      consultationQueries.push({ filter });
      return null;
    }, projectedFields);
  await assert.rejects(
    service.getOwnCompletedConsultation(ids.otherConsultation, patientUser),
    { statusCode: 404 }
  );
  assert.equal(consultationQueries[0].filter.patientId, ids.patient);
});

test("doctor record includes private notes only for own consultations", async () => {
  const result = await service.getDoctorPatientRecord(ids.patient, doctorUser);
  const ownQuery = consultationQueries.find(
    ({ filter }) => filter.doctorId === ids.doctor
  );
  const otherQuery = consultationQueries.find(
    ({ filter }) => filter.doctorId?.$ne === ids.doctor
  );
  assert.ok(ownQuery.projection.includes("privateNotes"));
  assert.equal(otherQuery.projection.includes("privateNotes"), false);
  assert.equal(result.consultations[0].privateNotes, "Only this doctor may see this note");
});

test("patients with appointment history cannot be hard deleted", async () => {
  await assert.rejects(patientService.deletePatient(ids.patient), {
    statusCode: 409,
  });
});
