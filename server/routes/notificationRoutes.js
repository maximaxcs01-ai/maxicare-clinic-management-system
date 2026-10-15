const express = require("express");
const controller = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);
router.get("/", controller.listMine);
router.get("/unread-count", controller.getUnreadCount);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markOneRead);

module.exports = router;
