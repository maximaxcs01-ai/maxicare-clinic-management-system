const queueService = require("../services/queueService");

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
    res.status(201).json({
      message: "Walk-in patient added to the queue.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNextDoctor, createWalkIn };
