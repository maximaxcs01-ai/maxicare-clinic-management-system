const { getDoctorAvailability } = require("../services/availabilityService");

const getAvailability = async (req, res, next) => {
  try {
    const result = await getDoctorAvailability({
      doctorId: req.query.doctorId,
      date: req.query.date,
      serviceId: req.query.serviceId,
    });
    res.json(result);
  } catch (error) { next(error); }
};

module.exports = { getAvailability };
