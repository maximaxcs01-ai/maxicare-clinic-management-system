const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const AuditLog = require("../models/AuditLog");
const auditService = require("../services/auditService");
const { authorize } = require("../middleware/authMiddleware");
const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const QueueEntry = require("../models/QueueEntry");
const doctorService = require("../services/doctorService");

const original = {
  find: AuditLog.find,
  countDocuments: AuditLog.countDocuments,
  create: AuditLog.create,
  appointmentExists: Appointment.exists,
  consultationExists: Consultation.exists,
  queueExists: QueueEntry.exists,
};

afterEach(() => {
  AuditLog.find = original.find;
  AuditLog.countDocuments = original.countDocuments;
  AuditLog.create = original.create;
  Appointment.exists = original.appointmentExists;
  Consultation.exists = original.consultationExists;
  QueueEntry.exists = original.queueExists;
});

test("audit metadata allowlists identifiers and transition fields only", () => {
  const sanitized = auditService.sanitizeMetadata({
    patientId: "720000000000000000000001",
    status: "completed",
    diagnosis: "must not be logged",
    privateNotes: "must not be logged",
    password: "must not be logged",
    setupToken: "must not be logged",
  });
  assert.deepEqual(sanitized, {
    patientId: "720000000000000000000001",
    status: "completed",
  });
});

test("audit creation records request context without clinical text or credentials", async () => {
  const actorId = "730000000000000000000001";
  let saved;
  AuditLog.create = async (value) => {
    saved = value;
    return value;
  };
  await auditService.recordRequestAudit(
    {
      user: { _id: actorId, role: "doctor" },
      ip: "127.0.0.1",
      get: () => "test-agent",
    },
    {
      action: "consultation.completed",
      entityType: "Consultation",
      entityId: "740000000000000000000001",
      description: "Consultation completed.",
      metadata: {
        status: "completed",
        diagnosis: "not stored",
        privateNotes: "not stored",
        password: "not stored",
      },
    }
  );
  assert.equal(String(saved.actorUserId), actorId);
  assert.equal(saved.actorRole, "doctor");
  assert.deepEqual(saved.metadata, { status: "completed" });
  assert.equal(saved.ipAddress, "127.0.0.1");
  assert.equal(saved.userAgent, "test-agent");
});

test("audit record fields are immutable and query write/delete middleware exists", () => {
  for (const field of [
    "actorUserId",
    "actorRole",
    "action",
    "entityType",
    "entityId",
    "patientId",
    "description",
    "metadata",
    "ipAddress",
    "userAgent",
  ]) {
    assert.equal(AuditLog.schema.path(field).options.immutable, true);
  }
});

test("audit updates and deletions are rejected by model middleware", async () => {
  await assert.rejects(
    AuditLog.updateOne({}, { $set: { action: "changed" } }),
    /append-only/
  );
  await assert.rejects(AuditLog.deleteOne({}), /append-only/);
});

test("audit authorization permits admins and blocks other roles", () => {
  const middleware = authorize("admin");
  let nextCalled = false;
  middleware({ user: { role: "admin" } }, {}, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);

  let status;
  let payload;
  middleware(
    { user: { role: "doctor" } },
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        payload = value;
      },
    },
    () => assert.fail("non-admin must not be authorized")
  );
  assert.equal(status, 403);
  assert.match(payload.message, /Not authorized/);
});

test("audit log filtering uses Manila date boundaries and pagination", async () => {
  let receivedFilter;
  let pagination;
  AuditLog.find = (filter) => {
    receivedFilter = filter;
    const query = {
      select() { return this; },
      populate() { return this; },
      sort() { return this; },
      skip(value) { pagination = { skip: value }; return this; },
      limit(value) { pagination.limit = value; return this; },
      lean() { return Promise.resolve([]); },
    };
    return query;
  };
  AuditLog.countDocuments = async () => 0;

  const result = await auditService.getAuditLogs({
    from: "2026-10-15",
    to: "2026-10-15",
    actorRole: "doctor",
    action: "consultation.completed",
    entityType: "Consultation",
    search: "safe",
    page: "2",
    limit: "10",
  });
  assert.equal(receivedFilter.createdAt.$gte.toISOString(), "2026-10-14T16:00:00.000Z");
  assert.equal(receivedFilter.createdAt.$lt.toISOString(), "2026-10-15T16:00:00.000Z");
  assert.equal(receivedFilter.actorRole, "doctor");
  assert.equal(receivedFilter.action, "consultation.completed");
  assert.equal(receivedFilter.entityType, "Consultation");
  assert.equal(pagination.skip, 10);
  assert.equal(pagination.limit, 10);
  assert.equal(result.pagination.page, 2);
});

test("audit log rejects invalid date ranges", async () => {
  await assert.rejects(
    auditService.getAuditLogs({ from: "2026-02-30", to: "2026-03-01" }),
    { statusCode: 400 }
  );
});

test("doctor deletion is blocked when clinical history exists", async () => {
  Appointment.exists = async () => true;
  Consultation.exists = async () => false;
  QueueEntry.exists = async () => false;
  await assert.rejects(
    doctorService.deleteDoctor("740000000000000000000001"),
    { statusCode: 409 }
  );
});
