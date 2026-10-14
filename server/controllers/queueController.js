const service = require("../services/queueService");
const { recordRequestAudit } = require("../services/auditService");

const listQueue = async (req, res, next) => {
  try {
    res.json(await service.listTodayQueue(req.user));
  } catch (error) {
    next(error);
  }
};

const callNext = async (req, res, next) => {
  try {
    const data = await service.callNextForDoctor(req.params.doctorId);
    await recordRequestAudit(req, {
      action: "queue.called",
      entityType: "QueueEntry",
      entityId: data._id,
      patientId: data.patientId?._id || data.patientId,
      description: "Queue entry called.",
      metadata: { doctorId: req.params.doctorId, patientId: data.patientId?._id || data.patientId, status: data.status },
    });
    res.json({ message: "Next patient called.", data });
  } catch (error) {
    next(error);
  }
};

const returnToWaiting = async (req, res, next) => {
  try {
    const data = await service.returnQueueEntryToWaiting(req.params.id);
    await recordRequestAudit(req, {
      action: "queue.returned_to_waiting",
      entityType: "QueueEntry",
      entityId: data._id,
      patientId: data.patientId?._id || data.patientId,
      description: "Queue entry returned to waiting.",
      metadata: { patientId: data.patientId?._id || data.patientId, status: data.status },
    });
    res.json({ message: "Patient returned to the waiting queue.", data });
  } catch (error) {
    next(error);
  }
};

const removeEntry = async (req, res, next) => {
  try {
    const data = await service.removeQueueEntry(
      req.params.id,
      req.validatedRemovalReason
    );
    await recordRequestAudit(req, {
      action: "queue.removed",
      entityType: "QueueEntry",
      entityId: data._id,
      patientId: data.patientId?._id || data.patientId,
      description: "Queue entry removed.",
      metadata: { patientId: data.patientId?._id || data.patientId, status: data.status },
    });
    res.json({ message: "Patient removed from the queue.", data });
  } catch (error) {
    next(error);
  }
};

module.exports = { listQueue, callNext, returnToWaiting, removeEntry };
