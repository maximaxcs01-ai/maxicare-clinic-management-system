const mongoose = require("mongoose");

const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "waiting",
  "in_consultation",
  "completed",
  "cancelled",
  "rejected",
  "no_show",
];

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
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
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: "pending",
      required: true,
    },
    bookingType: {
      type: String,
      enum: ["scheduled", "walk_in"],
      default: "scheduled",
      required: true,
    },
    reasonForVisit: { type: String, trim: true, maxlength: 1000, default: "" },
    slotReserved: { type: Boolean, default: true, required: true },
    checkedInAt: { type: Date },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rescheduleCount: { type: Number, default: 0, min: 0 },
    cancelledAt: { type: Date },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    rejectedAt: { type: Date },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    confirmedAt: { type: Date },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastRescheduledAt: { type: Date },
    lastRescheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    overrideReason: { type: String, trim: true, maxlength: 500 },
    statusHistory: [
      {
        status: {
          type: String,
          enum: APPOINTMENT_STATUSES,
          required: true,
        },
        changedAt: { type: Date, default: Date.now },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: { type: String },
        reason: { type: String, trim: true, maxlength: 500 },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

appointmentSchema.index(
  { doctorId: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { slotReserved: true },
    name: "reserved_doctor_slot_unique",
  }
);

appointmentSchema.index(
  { patientId: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { slotReserved: true },
    name: "reserved_patient_slot_unique",
  }
);

appointmentSchema.index({ patientId: 1, startAt: -1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
