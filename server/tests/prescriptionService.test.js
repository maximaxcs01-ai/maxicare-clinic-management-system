const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Prescription = require("../models/Prescription");
const service = require("../services/prescriptionService");
const { authorize } = require("../middleware/authMiddleware");
const {
  validatePrescriptionIssue,
} = require("../validators/prescriptionValidator");

const ids = {
  doctorUser: "100000000000000000000001",
  otherUser: "100000000000000000000002",
  doctor: "200000000000000000000001",
  consultation: "300000000000000000000001",
  appointment: "400000000000000000000001",
  patient: "500000000000000000000001",
  service: "600000000000000000000001",
  prescription: "700000000000000000000001",
};

const originalMethods = {
  doctorFindOne: Doctor.findOne,
  consultationFindOne: Consultation.findOne,
  prescriptionCreate: Prescription.create,
  prescriptionFindOne: Prescription.findOne,
  prescriptionFind: Prescription.find,
  prescriptionFindOneAndUpdate: Prescription.findOneAndUpdate,
  prescriptionExists: Prescription.exists,
  prescriptionCountDocuments: Prescription.countDocuments,
};

const makeQuery = (resolver, calls = []) => ({
  select(value) {
    calls.push(["select", value]);
    return this;
  },
  populate(path, projection) {
    calls.push(["populate", path, projection]);
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
    return Promise.resolve().then(resolver).then(onFulfilled, onRejected);
  },
});

const matches = (record, filter) =>
  record &&
  Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && "$in" in value) {
      return value.$in.includes(record[key]);
    }
    if (value && typeof value === "object" && "$ne" in value) {
      return record[key] !== value.$ne;
    }
    return String(record[key]) === String(value);
  });

let consultation;
let prescriptions;
let populateCalls;

const validMedication = {
  medicationName: "Example medicine",
  dosage: "1 tablet",
  frequency: "As directed",
  route: "Oral",
  duration: "5 days",
  quantity: "10 tablets",
  instructions: "",
};

const doctorUser = { _id: ids.doctorUser, role: "doctor" };

beforeEach(() => {
  consultation = {
    _id: ids.consultation,
    appointmentId: ids.appointment,
    patientId: ids.patient,
    doctorId: ids.doctor,
    serviceId: ids.service,
    status: "completed",
    diagnosis: "Confirmed diagnosis",
    treatmentPlan: "Treatment plan from consultation",
    instructions: "Patient instructions from consultation",
    chiefComplaint: "Relevant chief complaint",
    symptoms: "Relevant symptoms",
  };
  prescriptions = [];
  populateCalls = [];

  Doctor.findOne = (filter) =>
    makeQuery(() =>
      String(filter.userId) === ids.doctorUser
        ? { _id: ids.doctor }
        : { _id: "200000000000000000000002" }
    );
  Consultation.findOne = (filter) =>
    makeQuery(() => (matches(consultation, filter) ? consultation : null));
  Prescription.create = async (data) => {
    if (
      prescriptions.some(
        (item) => String(item.consultationId) === String(data.consultationId)
      )
    ) {
      const error = new Error("duplicate key prescription_consultation_unique");
      error.code = 11000;
      throw error;
    }
    const prescription = {
      ...data,
      _id: ids.prescription,
      medications: data.medications || [],
      generalInstructions: data.generalInstructions || "",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      save: async function save() {},
    };
    prescriptions.push(prescription);
    return prescription;
  };
  Prescription.findOne = (filter) =>
    makeQuery(() => {
      const found = prescriptions.find((item) => matches(item, filter));
      if (!found) return null;
      return {
        ...found,
        toObject: () => ({ ...found }),
      };
    }, populateCalls);
  Prescription.find = (filter) => ({
    populate(path, projection) {
      populateCalls.push(["populate", path, projection]);
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
      return Promise.resolve(
        prescriptions.filter((item) => matches(item, filter))
      ).then(resolve, reject);
    },
  });
  Prescription.countDocuments = async (filter) =>
    prescriptions.filter((item) => matches(item, filter)).length;
  Prescription.findOneAndUpdate = (filter, update) =>
    makeQuery(() => {
      const found = prescriptions.find((item) => matches(item, filter));
      if (!found) return null;
      Object.assign(found, update.$set);
      return found;
    });
  Prescription.exists = (filter) =>
    makeQuery(() =>
      prescriptions.some((item) => matches(item, filter))
        ? { _id: ids.prescription }
        : null
    );
});

afterEach(() => {
  Doctor.findOne = originalMethods.doctorFindOne;
  Consultation.findOne = originalMethods.consultationFindOne;
  Prescription.create = originalMethods.prescriptionCreate;
  Prescription.findOne = originalMethods.prescriptionFindOne;
  Prescription.find = originalMethods.prescriptionFind;
  Prescription.findOneAndUpdate = originalMethods.prescriptionFindOneAndUpdate;
  Prescription.exists = originalMethods.prescriptionExists;
  Prescription.countDocuments = originalMethods.prescriptionCountDocuments;
});

test("blocks prescriptions when a different doctor owns the consultation", async () => {
  await assert.rejects(
    service.createPrescription(ids.consultation, {
      _id: ids.otherUser,
      role: "doctor",
    }),
    { statusCode: 404 }
  );
  assert.equal(prescriptions.length, 0);
});

test("creates at most one draft for a consultation", async () => {
  const created = await service.createPrescription(ids.consultation, doctorUser);
  assert.equal(created.status, "draft");
  assert.equal(created.consultationId, ids.consultation);
  assert.equal(created.patientId, ids.patient);
  assert.equal(created.appointmentId, ids.appointment);
  assert.equal(created.serviceId, ids.service);
  assert.equal(prescriptions[0].doctorId, ids.doctor);
  await assert.rejects(
    service.createPrescription(ids.consultation, doctorUser),
    { statusCode: 409 }
  );
  assert.equal(prescriptions.length, 1);
});

test("allows repeated draft saves for the assigned doctor", async () => {
  await service.createPrescription(ids.consultation, doctorUser);
  const first = await service.saveDraft(ids.prescription, doctorUser, {
    medications: [validMedication],
    generalInstructions: "General note",
  });
  assert.equal(first.medications[0].medicationName, validMedication.medicationName);
  const second = await service.saveDraft(ids.prescription, doctorUser, {
    medications: [{ ...validMedication, dosage: "2 tablets" }],
    generalInstructions: "Updated note",
  });
  assert.equal(second.medications[0].dosage, "2 tablets");
  assert.equal(second.generalInstructions, "Updated note");
});

test("saving a draft without legacy general instructions preserves the stored value", async () => {
  await service.createPrescription(ids.consultation, doctorUser);
  prescriptions[0].generalInstructions = "Legacy prescription text";

  const saved = await service.saveDraft(ids.prescription, doctorUser, {
    medications: [validMedication],
  });

  assert.equal(saved.generalInstructions, "Legacy prescription text");
  assert.equal(saved.medications[0].medicationName, validMedication.medicationName);
});

test("issuing without legacy general instructions preserves the stored value", async () => {
  await service.createPrescription(ids.consultation, doctorUser);
  prescriptions[0].generalInstructions = "Legacy prescription text";

  const issued = await service.issuePrescription(ids.prescription, doctorUser, {
    medications: [validMedication],
  });

  assert.equal(issued.status, "issued");
  assert.equal(issued.generalInstructions, "Legacy prescription text");
});

test("prescription context projection includes consultation fields and excludes private notes", async () => {
  await service.createPrescription(ids.consultation, doctorUser);
  await service.getPrescription(ids.prescription, doctorUser);
  const consultationPopulate = populateCalls.find(
    ([kind, path]) =>
      kind === "populate" &&
      (path === "consultationId" || path?.path === "consultationId")
  );
  assert.ok(consultationPopulate);
  const projection =
    typeof consultationPopulate[1] === "object"
      ? consultationPopulate[1].select
      : consultationPopulate[2];
  for (const field of [
    "diagnosis",
    "treatmentPlan",
    "instructions",
    "chiefComplaint",
    "symptoms",
  ]) {
    assert.ok(projection.includes(field), `${field} should be available as context`);
  }
  assert.equal(projection.includes("privateNotes"), false);
});

test("requires at least one medication before issuing", async () => {
  await service.createPrescription(ids.consultation, doctorUser);
  await assert.rejects(
    service.issuePrescription(ids.prescription, doctorUser, {
      medications: [],
      generalInstructions: "",
    }),
    { statusCode: 400 }
  );

  const req = { body: { medications: [], generalInstructions: "" } };
  let statusCode;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {},
  };
  validatePrescriptionIssue(req, res, () => {});
  assert.equal(statusCode, 400);
});

test("issues a draft and rejects further edits", async () => {
  await service.createPrescription(ids.consultation, doctorUser);
  await service.saveDraft(ids.prescription, doctorUser, {
    medications: [validMedication],
    generalInstructions: "",
  });
  const issued = await service.issuePrescription(ids.prescription, doctorUser, {
    medications: [validMedication],
    generalInstructions: "",
  });
  assert.equal(issued.status, "issued");
  assert.ok(issued.issuedAt instanceof Date);
  await assert.rejects(
    service.saveDraft(ids.prescription, doctorUser, {
      medications: [],
      generalInstructions: "",
    }),
    { statusCode: 409 }
  );
});

test("prescription response projection does not select consultation privateNotes", async () => {
  await service.createPrescription(ids.consultation, doctorUser);
  await service.getPrescription(ids.prescription, doctorUser);
  const consultationPopulate = populateCalls.find(
    ([kind, path]) =>
      kind === "populate" &&
      (path === "consultationId" || path?.path === "consultationId")
  );
  assert.ok(consultationPopulate);
  const projection =
    typeof consultationPopulate[1] === "object"
      ? consultationPopulate[1].select
      : consultationPopulate[2];
  assert.equal(projection.includes("privateNotes"), false);
});

test("prescription validators allow legacy general instructions to be omitted", () => {
  let validated;
  let statusCode;
  const req = { body: { medications: [validMedication] } };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {},
  };

  validatePrescriptionIssue(req, res, () => {
    validated = req.validatedPrescription;
  });

  assert.equal(statusCode, undefined);
  assert.deepEqual(validated, { medications: [validMedication] });
});

test("prescription API role guard blocks patients, receptionists, and admins", () => {
  const doctorOnly = authorize("doctor");
  for (const role of ["patient", "receptionist", "admin"]) {
    let statusCode;
    doctorOnly(
      { user: { role } },
      {
        status(code) {
          statusCode = code;
          return this;
        },
        json() {},
      },
      () => assert.fail(`${role} should not be authorized`)
    );
    assert.equal(statusCode, 403);
  }
});
