const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");
const { getManilaDateRange, isValidDateString } = require("../utils/manilaDateRange");
const AppError = require("../utils/AppError");

const SAFE_METADATA_KEYS = new Set([
  "fromStatus",
  "toStatus",
  "bookingType",
  "patientId",
  "doctorId",
  "serviceId",
  "appointmentId",
  "queueEntryId",
  "consultationId",
  "prescriptionId",
  "userId",
  "portalStatus",
  "status",
  "rescheduleCount",
]);

const sanitizeMetadata = (metadata = {}) =>
  Object.fromEntries(
    Object.entries(metadata).filter(
      ([key, value]) =>
        SAFE_METADATA_KEYS.has(key) &&
        (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value == null ||
          (value?._bsontype === "ObjectId"))
    )
  );

const recordAudit = async (
  {
    actorUserId,
    actorRole,
    action,
    entityType,
    entityId,
    patientId,
    description,
    metadata,
  },
  request,
  session
) => {
  if (entityId && !mongoose.isValidObjectId(entityId)) {
    throw new AppError("Invalid audit entity identifier.", 400);
  }
  const auditData = {
    actorUserId,
    actorRole: actorRole || "system",
    action,
    entityType,
    entityId,
    patientId: patientId || null,
    description,
    metadata: sanitizeMetadata(metadata),
    ipAddress:
      typeof request?.ip === "string" ? request.ip.slice(0, 100) : "",
    userAgent:
      typeof request?.get === "function"
        ? (request.get("user-agent") || "").slice(0, 300)
        : "",
  };
  if (session) {
    const [entry] = await AuditLog.create([auditData], { session });
    return entry;
  }
  return AuditLog.create(auditData);
};

const recordRequestAudit = (request, event, session) =>
  recordAudit(
    {
      ...event,
      actorUserId: request.user?._id || null,
      actorRole: request.user?.role || "system",
    },
    request,
    session
  );

const getAuditLogs = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.from || query.to) {
    if (!isValidDateString(query.from) || !isValidDateString(query.to)) {
      throw new AppError("Select a valid date-from and date-to range.", 400);
    }
    const { start, end } = getManilaDateRange(query.from, query.to);
    filter.createdAt = { $gte: start, $lt: end };
  }
  if (["patient", "receptionist", "doctor", "admin", "system"].includes(query.actorRole)) {
    filter.actorRole = query.actorRole;
  }
  if (typeof query.action === "string" && query.action.trim()) {
    filter.action = query.action.trim().slice(0, 80);
  }
  if (typeof query.entityType === "string" && query.entityType.trim()) {
    filter.entityType = query.entityType.trim().slice(0, 50);
  }
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = new RegExp(escapeRegex(search.slice(0, 100)), "i");
    filter.$or = [
      { description: pattern },
      { action: pattern },
      { entityType: pattern },
    ];
    if (/^[a-f\d]{24}$/i.test(search)) {
      filter.$or.push({ entityId: search }, { patientId: search });
    }
  }

  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .select("actorUserId actorRole action entityType entityId patientId description metadata createdAt")
      .populate("actorUserId", "firstName lastName")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { data, pagination: buildPagination(page, limit, total) };
};

module.exports = {
  recordAudit,
  recordRequestAudit,
  getAuditLogs,
  sanitizeMetadata,
};
