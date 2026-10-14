const mongoose = require("mongoose");

const periodSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const overrideSchema = new mongoose.Schema({
  date: { type: String, required: true },
  type: { type: String, enum: ["unavailable", "custom"], required: true },
  periods: { type: [periodSchema], default: [] },
});

const weeklySchedule = {};
for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
  weeklySchedule[day] = { type: [periodSchema], default: [] };
}

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      unique: true,
    },
    weeklySchedule,
    dateOverrides: { type: [overrideSchema], default: [] },
    timezone: { type: String, default: "Asia/Manila", immutable: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoctorSchedule", doctorScheduleSchema);
