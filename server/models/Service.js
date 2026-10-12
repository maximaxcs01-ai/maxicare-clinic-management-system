const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, unique: true, select: false },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    fee: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1, default: 30 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
