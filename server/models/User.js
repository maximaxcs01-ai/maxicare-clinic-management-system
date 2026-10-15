const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    middleName: {
      type: String,
      trim: true,
      default: "",
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    profileImage: {
      url: { type: String, trim: true, default: "" },
      publicId: { type: String, trim: true, default: "", select: false },
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["patient", "receptionist", "doctor", "admin"],
      default: "patient",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    emailVerified: {
      type: Boolean,
      default: true,
    },

    passwordSetupRequired: {
      type: Boolean,
      default: false,
    },

    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
