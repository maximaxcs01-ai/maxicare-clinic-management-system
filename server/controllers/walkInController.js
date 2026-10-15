const queueService = require("../services/queueService");
const notifications = require("../services/notificationService");

const getNextDoctor = async (req, res, next) => {
  try {
    res.json(await queueService.getNextDoctorForService(req.walkInServiceId));
  } catch (error) {
    next(error);
  }
};

const createWalkIn = async (req, res, next) => {
  try {
    const data = await queueService.createWalkIn(req.validatedWalkIn, req.user, req);
    await notifications.publishSafely(() =>
      notifications.notifyDoctor(data.queueEntry?.doctorId?._id || data.queueEntry?.doctorId, {
        type: "patient_waiting",
        title: "Patient Waiting",
        message: `${data.queueEntry?.patientId?.firstName || "A patient"} ${data.queueEntry?.patientId?.lastName || ""}`.trim() +
          " is waiting in your queue.",
        targetType: "doctor_queue",
        targetId: data.queueEntry?._id,
        dedupeKey: `queue:${data.queueEntry?._id}:waiting`,
      })
    );
    res.status(201).json({
      message: "Walk-in patient added to the queue.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNextDoctor, createWalkIn };
