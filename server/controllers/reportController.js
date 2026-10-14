const service = require("../services/reportService");

const getReports = async (req, res, next) => {
  try {
    res.json({ data: await service.getReports(req.query) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReports };
