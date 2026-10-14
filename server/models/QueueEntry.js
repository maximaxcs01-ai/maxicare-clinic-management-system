const mongoose = require("mongoose");

const queueEntrySchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    queueStatus: {
      type: String,
      enum: ["waiting", "called", "removed", "expired"],
      default: "waiting",
      required: true,
    },
    active: { type: Boolean, default: true, required: true },
    joinedAt: { type: Date, default: Date.now, required: true },
    calledAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    expirationReason: { type: String, trim: true, maxlength: 500, default: "" },
    removalReason: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

queueEntrySchema.index(
  { appointmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: "active_queue_appointment_unique",
  }
);
queueEntrySchema.index(
  { patientId: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: "active_queue_patient_unique",
  }
);
queueEntrySchema.index(
  { doctorId: 1, active: 1, queueStatus: 1, joinedAt: 1, _id: 1 },
  { name: "active_doctor_queue_order" }
);

module.exports = mongoose.model("QueueEntry", queueEntrySchema);
