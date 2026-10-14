const service = require("../services/queueService");

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
    res.json({ message: "Next patient called.", data });
  } catch (error) {
    next(error);
  }
};

const returnToWaiting = async (req, res, next) => {
  try {
    const data = await service.returnQueueEntryToWaiting(req.params.id);
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
    res.json({ message: "Patient removed from the queue.", data });
  } catch (error) {
    next(error);
  }
};

module.exports = { listQueue, callNext, returnToWaiting, removeEntry };
