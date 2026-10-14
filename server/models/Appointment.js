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
      enum: ["scheduled"],
      default: "scheduled",
      required: true,
    },
    reasonForVisit: { type: String, trim: true, maxlength: 1000, default: "" },
    slotReserved: { type: Boolean, default: true, required: true },
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
