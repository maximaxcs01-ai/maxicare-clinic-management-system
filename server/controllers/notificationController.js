const service = require("../services/notificationService");

const listMine = async (req, res, next) => {
  try {
    res.json(await service.listMine(req.user._id, req.query.limit));
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    res.json({ unreadCount: await service.getUnreadCount(req.user._id) });
  } catch (error) {
    next(error);
  }
};

const markOneRead = async (req, res, next) => {
  try {
    res.json({ data: await service.markOneRead(req.params.id, req.user._id) });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    res.json({ data: await service.markAllRead(req.user._id) });
  } catch (error) {
    next(error);
  }
};

module.exports = { listMine, getUnreadCount, markOneRead, markAllRead };
