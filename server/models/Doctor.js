const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    doctorNumber: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: "" },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNumber: { type: String, required: true, trim: true, match: /^09\d{9}$/ },
    licenseNumber: { type: String, required: true, unique: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    profileImage: {
      url: { type: String, trim: true, default: "" },
      publicId: { type: String, trim: true, default: "", select: false },
    },
    serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

doctorSchema.index({ lastName: 1, firstName: 1 });

module.exports = mongoose.model("Doctor", doctorSchema);
