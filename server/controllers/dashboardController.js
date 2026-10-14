const service = require("../services/dashboardService");

const getDashboard = async (req, res, next) => {
  try {
    res.json({ data: await service.getDashboard(req.user) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
