const Appointment = require("../models/Appointment");
const Consultation = require("../models/Consultation");
const Patient = require("../models/Patient");
const AppError = require("../utils/AppError");
const { getManilaDateRange, isValidDateString } = require("../utils/manilaDateRange");

const getReportRange = (query = {}) => {
  const from = query.from;
  const to = query.to;
  if (!isValidDateString(from) || !isValidDateString(to)) {
    throw new AppError(
      "Provide valid from and to Manila dates in YYYY-MM-DD format.",
      400
    );
  }
  return { from, to, ...getManilaDateRange(from, to) };
};

const getReports = async (query) => {
  const range = getReportRange(query);
  const appointmentMatch = {
    startAt: { $gte: range.start, $lt: range.end },
  };
  const consultationMatch = {
    status: "completed",
    completedAt: { $gte: range.start, $lt: range.end },
  };
  const patientMatch = {
    createdAt: { $gte: range.start, $lt: range.end },
  };

  const [
    appointmentSummary,
    serviceAppointments,
    serviceConsultations,
    doctorAppointments,
    doctorConsultations,
    newPatients,
    patientsWithAppointments,
  ] = await Promise.all([
    Appointment.aggregate([
      { $match: appointmentMatch },
      {
        $group: {
          _id: { status: "$status", bookingType: "$bookingType" },
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.aggregate([
      { $match: appointmentMatch },
      {
        $group: {
          _id: "$serviceId",
          appointmentCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "_id",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          serviceId: "$_id",
          service: { $ifNull: ["$service.name", "Service unavailable"] },
          appointmentCount: 1,
        },
      },
    ]),
    Consultation.aggregate([
      { $match: consultationMatch },
      { $group: { _id: "$serviceId", completedConsultationCount: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $match: appointmentMatch },
      {
        $group: {
          _id: "$doctorId",
          appointmentCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          doctorId: "$_id",
          doctor: {
            $cond: [
              { $ifNull: ["$doctor._id", false] },
              {
                $concat: [
                  "$doctor.firstName",
                  " ",
                  "$doctor.lastName",
                ],
              },
              "Doctor unavailable",
            ],
          },
          appointmentCount: 1,
        },
      },
    ]),
    Consultation.aggregate([
      { $match: consultationMatch },
      {
        $group: {
          _id: "$doctorId",
          completedConsultationCount: { $sum: 1 },
        },
      },
    ]),
    Patient.countDocuments(patientMatch),
    Appointment.aggregate([
      { $match: appointmentMatch },
      { $group: { _id: "$patientId" } },
      { $count: "total" },
    ]),
  ]);

  const summary = appointmentSummary.reduce(
    (totals, group) => {
      const count = group.count || 0;
      totals.total += count;
      if (group._id.status) {
        totals.statuses[group._id.status] =
          (totals.statuses[group._id.status] || 0) + count;
      }
      if (group._id.bookingType) {
        totals.bookingTypes[group._id.bookingType] =
          (totals.bookingTypes[group._id.bookingType] || 0) + count;
      }
      return totals;
    },
    { total: 0, statuses: {}, bookingTypes: {} }
  );
  const serviceConsultationCounts = new Map(
    serviceConsultations.map((row) => [
      String(row._id),
      row.completedConsultationCount,
    ])
  );
  const doctorConsultationCounts = new Map(
    doctorConsultations.map((row) => [
      String(row._id),
      row.completedConsultationCount,
    ])
  );
  const serviceRows = new Map(
    serviceAppointments.map((row) => [String(row.serviceId), { ...row }])
  );
  for (const row of serviceConsultations) {
    const key = String(row._id);
    const existing = serviceRows.get(key);
    if (existing) continue;
    serviceRows.set(key, {
      serviceId: row._id,
      service: "Service unavailable",
      appointmentCount: 0,
    });
  }
  const doctorRows = new Map(
    doctorAppointments.map((row) => [String(row.doctorId), { ...row }])
  );
  for (const row of doctorConsultations) {
    const key = String(row._id);
    const existing = doctorRows.get(key);
    if (existing) continue;
    doctorRows.set(key, {
      doctorId: row._id,
      doctor: "Doctor unavailable",
      appointmentCount: 0,
    });
  }

  return {
    range: { from: range.from, to: range.to },
    appointmentSummary: {
      total: summary.total,
      byStatus: summary.statuses,
      bookingTypes: summary.bookingTypes,
    },
    serviceUtilization: [...serviceRows.values()].map((row) => ({
      ...row,
      completedConsultationCount:
        serviceConsultationCounts.get(String(row.serviceId)) || 0,
    })),
    doctorActivity: [...doctorRows.values()].map((row) => ({
      ...row,
      completedConsultationCount:
        doctorConsultationCounts.get(String(row.doctorId)) || 0,
    })),
    patientActivity: {
      newPatients,
      patientsWithAppointments:
        patientsWithAppointments[0]?.total || 0,
    },
  };
};

module.exports = { getReportRange, getReports };
