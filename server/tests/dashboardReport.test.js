const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Prescription = require("../models/Prescription");
const QueueEntry = require("../models/QueueEntry");
const Service = require("../models/Service");
const dashboardService = require("../services/dashboardService");
const reportService = require("../services/reportService");
const { authorize } = require("../middleware/authMiddleware");
const {
  getManilaDayRange,
  getManilaDateRange,
  getManilaDate,
  isValidDateString,
} = require("../utils/manilaDateRange");

const ids = {
  patientUser: "710000000000000000000001",
  patient: "720000000000000000000001",
  doctorUser: "730000000000000000000001",
  doctor: "740000000000000000000001",
};

const original = {
  appointmentAggregate: Appointment.aggregate,
  appointmentCountDocuments: Appointment.countDocuments,
  appointmentFind: Appointment.find,
  appointmentFindOne: Appointment.findOne,
  appointmentDistinct: Appointment.distinct,
  consultationAggregate: Consultation.aggregate,
  consultationCountDocuments: Consultation.countDocuments,
  consultationFind: Consultation.find,
  doctorFindOne: Doctor.findOne,
  doctorCountDocuments: Doctor.countDocuments,
  patientFindOne: Patient.findOne,
  patientCountDocuments: Patient.countDocuments,
  prescriptionCountDocuments: Prescription.countDocuments,
  queueCountDocuments: QueueEntry.countDocuments,
  serviceCountDocuments: Service.countDocuments,
};

afterEach(() => {
  Appointment.aggregate = original.appointmentAggregate;
  Appointment.countDocuments = original.appointmentCountDocuments;
  Appointment.find = original.appointmentFind;
  Appointment.findOne = original.appointmentFindOne;
  Appointment.distinct = original.appointmentDistinct;
  Consultation.aggregate = original.consultationAggregate;
  Consultation.countDocuments = original.consultationCountDocuments;
  Consultation.find = original.consultationFind;
  Doctor.findOne = original.doctorFindOne;
  Doctor.countDocuments = original.doctorCountDocuments;
  Patient.findOne = original.patientFindOne;
  Patient.countDocuments = original.patientCountDocuments;
  Prescription.countDocuments = original.prescriptionCountDocuments;
  QueueEntry.countDocuments = original.queueCountDocuments;
  Service.countDocuments = original.serviceCountDocuments;
});

const query = (result, calls = {}) => ({
  select(value) {
    calls.select?.(value);
    return this;
  },
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  populate() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(result).then(resolve, reject);
  },
});

test("Manila ranges use local midnight and inclusive calendar date boundaries", () => {
  const day = getManilaDayRange("2026-10-15");
  assert.equal(day.start.toISOString(), "2026-10-14T16:00:00.000Z");
  assert.equal(day.end.toISOString(), "2026-10-15T16:00:00.000Z");
  assert.equal(getManilaDate(new Date("2026-10-14T16:00:00.000Z")), "2026-10-15");
  const range = getManilaDateRange("2026-10-01", "2026-10-15");
  assert.equal(range.start.toISOString(), "2026-09-30T16:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-15T16:00:00.000Z");
  assert.equal(isValidDateString("2026-02-30"), false);
  assert.throws(() => getManilaDateRange("2026-10-16", "2026-10-15"), {
    statusCode: 400,
  });
});

test("appointment status aggregation returns counts for every status", async () => {
  let pipeline;
  Appointment.aggregate = async (value) => {
    pipeline = value;
    return [
      { _id: "pending", count: 2 },
      { _id: "waiting", count: 1 },
    ];
  };
  const counts = await dashboardService.countByAppointmentStatus({
    startAt: { $gte: new Date("2026-10-14T16:00:00Z") },
  });
  assert.equal(pipeline[0].$match.startAt.$gte.toISOString(), "2026-10-14T16:00:00.000Z");
  assert.equal(counts.pending, 2);
  assert.equal(counts.waiting, 1);
  assert.equal(counts.completed, 0);
  assert.equal(Object.keys(counts).length, 9);
});

test("patient dashboard scopes all patient records to the authenticated user", async () => {
  const filters = [];
  const consultationFields = [];
  Patient.findOne = (filter) => {
    assert.deepEqual(filter, { userId: ids.patientUser });
    return query({ _id: ids.patient });
  };
  Appointment.findOne = (filter) => {
    filters.push(filter);
    return query(null);
  };
  Appointment.countDocuments = async (filter) => {
    filters.push(filter);
    return 2;
  };
  Consultation.find = (filter) => {
    filters.push(filter);
    return query([], { select: (value) => consultationFields.push(value) });
  };
  Prescription.countDocuments = async (filter) => {
    filters.push(filter);
    return 1;
  };

  const result = await dashboardService.getDashboard({
    _id: ids.patientUser,
    role: "patient",
    patientId: "must-not-be-used",
  });
  assert.equal(result.upcomingCount, 2);
  assert.equal(result.issuedPrescriptionCount, 1);
  assert.ok(filters.every((filter) => String(filter.patientId) === ids.patient));
  assert.equal(
    consultationFields.some((fields) => fields.includes("privateNotes")),
    false
  );
});

test("doctor dashboard resolves and scopes data using the authenticated Doctor", async () => {
  const appointmentFilters = [];
  Doctor.findOne = (filter) => {
    assert.deepEqual(filter, { userId: ids.doctorUser });
    return query({ _id: ids.doctor });
  };
  Appointment.countDocuments = async (filter) => {
    appointmentFilters.push(filter);
    return 0;
  };
  Appointment.find = (filter) => {
    appointmentFilters.push(filter);
    return query([]);
  };
  QueueEntry.countDocuments = async (filter) => {
    assert.equal(String(filter.doctorId), ids.doctor);
    return 0;
  };
  Consultation.findOne = (filter) => {
    assert.equal(String(filter.doctorId), ids.doctor);
    return query(null);
  };
  Consultation.countDocuments = async (filter) => {
    assert.equal(String(filter.doctorId), ids.doctor);
    return 0;
  };

  await dashboardService.getDashboard({
    _id: ids.doctorUser,
    role: "doctor",
  });
  assert.ok(
    appointmentFilters.every(
      (filter) => String(filter.doctorId) === ids.doctor
    )
  );
});

test("reports aggregate totals and activity within Manila date bounds only", async () => {
  const appointmentPipelines = [];
  const consultationPipelines = [];
  let aggregateCalls = 0;
  Appointment.aggregate = async (pipeline) => {
    appointmentPipelines.push(pipeline);
    aggregateCalls += 1;
    if (aggregateCalls === 1) {
      return [
        { _id: { status: "confirmed", bookingType: "scheduled" }, count: 2 },
        { _id: { status: "completed", bookingType: "walk_in" }, count: 1 },
      ];
    }
    if (aggregateCalls === 2) {
      return [
        {
          serviceId: "service-id",
          service: "General Consultation",
          appointmentCount: 3,
        },
      ];
    }
    if (aggregateCalls === 3) {
      return [
        {
          doctorId: "doctor-id",
          doctor: "Test Doctor",
          appointmentCount: 3,
        },
      ];
    }
    return [{ total: 2 }];
  };
  Consultation.aggregate = async (pipeline) => {
    consultationPipelines.push(pipeline);
    return [
      {
        _id:
          pipeline[1].$group._id === "$serviceId"
            ? "service-id"
            : "doctor-id",
        completedConsultationCount: 1,
      },
      {
        _id:
          pipeline[1].$group._id === "$serviceId"
            ? "completed-only-service"
            : "completed-only-doctor",
        completedConsultationCount: 2,
      },
    ];
  };
  Patient.countDocuments = async (filter) => {
    assert.equal(
      filter.createdAt.$gte.toISOString(),
      "2026-09-30T16:00:00.000Z"
    );
    assert.equal(
      filter.createdAt.$lt.toISOString(),
      "2026-10-15T16:00:00.000Z"
    );
    return 4;
  };

  const result = await reportService.getReports({
    from: "2026-10-01",
    to: "2026-10-15",
  });
  assert.equal(result.appointmentSummary.total, 3);
  assert.equal(result.appointmentSummary.byStatus.confirmed, 2);
  assert.equal(result.appointmentSummary.bookingTypes.walk_in, 1);
  assert.equal(result.serviceUtilization[0].completedConsultationCount, 1);
  assert.equal(result.doctorActivity[0].completedConsultationCount, 1);
  assert.equal(result.serviceUtilization.length, 2);
  assert.equal(
    result.serviceUtilization[1].completedConsultationCount,
    2
  );
  assert.equal(result.serviceUtilization[1].appointmentCount, 0);
  assert.equal(result.doctorActivity.length, 2);
  assert.equal(result.patientActivity.newPatients, 4);
  assert.equal(result.patientActivity.patientsWithAppointments, 2);
  for (const pipeline of [...appointmentPipelines, ...consultationPipelines]) {
    assert.equal(JSON.stringify(pipeline).includes("privateNotes"), false);
    const match = pipeline.find((stage) => stage.$match);
    if (match) {
      const dateField = match.$match.startAt
        ? match.$match.startAt
        : match.$match.completedAt;
      assert.equal(dateField.$gte.toISOString(), "2026-09-30T16:00:00.000Z");
      assert.equal(dateField.$lt.toISOString(), "2026-10-15T16:00:00.000Z");
    }
  }
});

test("reports are admin-only", () => {
  const adminOnly = authorize("admin");
  let statusCode;
  adminOnly(
    { user: { role: "doctor" } },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {},
    },
    () => assert.fail("Doctor should not access clinic-wide reports")
  );
  assert.equal(statusCode, 403);
});
