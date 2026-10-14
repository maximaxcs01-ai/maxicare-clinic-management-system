const service = require("../services/auditService");

const getAuditLogs = async (req, res, next) => {
  try {
    res.json(await service.getAuditLogs(req.query));
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs };
