const scheduleService = require("../services/scheduleService");

const getSchedule = async (req, res, next) => {
  try {
    const result = await scheduleService.getSchedule(req.params.doctorId, req.user);
    res.json({
      doctor: {
        id: result.doctor._id,
        doctorNumber: result.doctor.doctorNumber,
        firstName: result.doctor.firstName,
        middleName: result.doctor.middleName,
        lastName: result.doctor.lastName,
        status: result.doctor.status,
      },
      schedule: result.schedule,
    });
  } catch (error) { next(error); }
};

const saveSchedule = async (req, res, next) => {
  try {
    const result = await scheduleService.saveSchedule(req.params.doctorId, req.validatedSchedule, req.user);
    res.json({ message: "Doctor schedule saved successfully", schedule: result.schedule });
  } catch (error) { next(error); }
};

module.exports = { getSchedule, saveSchedule };
