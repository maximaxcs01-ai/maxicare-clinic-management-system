const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
    },
    actorRole: {
      type: String,
      required: true,
      enum: ["patient", "receptionist", "doctor", "admin", "system"],
      immutable: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 80, immutable: true },
    entityType: { type: String, required: true, trim: true, maxlength: 50, immutable: true },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
      immutable: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 240, immutable: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    ipAddress: { type: String, maxlength: 100, default: "", immutable: true },
    userAgent: { type: String, maxlength: 300, default: "", immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true }
);

auditLogSchema.index({ createdAt: -1, _id: -1 });
auditLogSchema.index({ actorRole: 1, action: 1, entityType: 1, createdAt: -1 });
auditLogSchema.index({ patientId: 1, createdAt: -1 });

const immutableError = () => {
  throw new Error("Audit logs are append-only and cannot be changed or removed.");
};

auditLogSchema.pre("save", function preventAuditLogUpdate() {
  if (!this.isNew) immutableError();
});
auditLogSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"],
  immutableError
);
auditLogSchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete"],
  immutableError
);
auditLogSchema.pre("deleteOne", { document: true, query: false }, immutableError);

module.exports = mongoose.model("AuditLog", auditLogSchema);
