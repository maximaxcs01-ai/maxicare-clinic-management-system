const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
      match: /^[\p{L}\s'-]+$/u,
    },

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
      required: true,
      validate: {
        validator: (value) => value <= new Date(),
        message: "Date of birth cannot be in the future",
      },
    },

    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female"],
    },

    contactNumber: {
      type: String,
      required: true,
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
        required: true,
        trim: true,
      },

      barangay: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      province: {
        type: String,
        required: true,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Patient", patientSchema);
