const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
  {
    medicationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    dosage: { type: String, required: true, trim: true, maxlength: 100 },
    frequency: { type: String, required: true, trim: true, maxlength: 200 },
    route: { type: String, trim: true, maxlength: 100, default: "" },
    duration: { type: String, required: true, trim: true, maxlength: 100 },
    quantity: { type: String, trim: true, maxlength: 100, default: "" },
    instructions: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { _id: true }
);

const prescriptionSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consultation",
      required: true,
    },
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
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "issued"],
      default: "draft",
      required: true,
    },
    issuedAt: { type: Date, default: null },
    generalInstructions: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    medications: { type: [medicationSchema], default: [] },
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

prescriptionSchema.index(
  { consultationId: 1 },
  { unique: true, name: "prescription_consultation_unique" }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
