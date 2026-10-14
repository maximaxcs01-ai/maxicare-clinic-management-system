const mongoose = require("mongoose");

const consultationSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
      required: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    chiefComplaint: { type: String, trim: true, maxlength: 2000, default: "" },
    symptoms: { type: String, trim: true, maxlength: 5000, default: "" },
    vitals: {
      systolic: { type: Number, min: 0, max: 400, default: null },
      diastolic: { type: Number, min: 0, max: 300, default: null },
      temperature: { type: Number, min: 20, max: 50, default: null },
      pulse: { type: Number, min: 0, max: 300, default: null },
      respiratoryRate: { type: Number, min: 0, max: 100, default: null },
      oxygenSaturation: { type: Number, min: 0, max: 100, default: null },
      weight: { type: Number, min: 0, max: 1000, default: null },
      height: { type: Number, min: 0, max: 300, default: null },
    },
    diagnosis: { type: String, trim: true, maxlength: 5000, default: "" },
    treatmentPlan: { type: String, trim: true, maxlength: 5000, default: "" },
    instructions: { type: String, trim: true, maxlength: 5000, default: "" },
    privateNotes: { type: String, trim: true, maxlength: 10000, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

consultationSchema.index(
  { appointmentId: 1 },
  { unique: true, name: "consultation_appointment_unique" }
);

module.exports = mongoose.model("Consultation", consultationSchema);
