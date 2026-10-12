const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
    },

    patientNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
      match: /^[\p{L}\s'-]+$/u,
    },

    middleName: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    suffix: { type: String, trim: true, maxlength: 20, default: "" },

    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
      match: /^[\p{L}\s'-]+$/u,
    },

    dateOfBirth: {
      type: Date,
      validate: {
        validator: (value) => value <= new Date(),
        message: "Date of birth cannot be in the future",
      },
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
    },

    sex: { type: String, enum: ["Male", "Female"] },

    contactNumber: {
      type: String,
      trim: true,
      match: /^09\d{9}$/,
    },

    mobileNumber: {
      type: String,
      trim: true,
      match: /^09\d{9}$/,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    address: {
      street: {
        type: String,
        trim: true,
      },

      barangay: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      province: {
        type: String,
        trim: true,
      },

      zipCode: { type: String, trim: true, maxlength: 10 },
    },

    emergencyContact: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      relationship: { type: String, trim: true },
      mobileNumber: { type: String, trim: true, match: /^09\d{9}$/ },
    },

    medicalSummary: {
      bloodType: { type: String, trim: true },
      allergies: { type: String, trim: true },
      existingConditions: { type: String, trim: true },
    },

    portalStatus: {
      type: String,
      enum: ["not_activated", "invited", "active", "inactive"],
      default: "not_activated",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Patient", patientSchema);
