const express = require("express");
const controller = require("../controllers/queueController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validateObjectIdParam,
  validateQueueRemoval,
} = require("../validators/queueValidator");

const router = express.Router();
router.use(protect);
router.get("/my", authorize("doctor"), controller.listQueue);
router.get("/", authorize("admin", "receptionist"), controller.listQueue);
router.post(
  "/doctors/:doctorId/call-next",
  authorize("admin", "receptionist", "doctor"),
  validateObjectIdParam("doctorId"),
  controller.callNext
);
router.patch(
  "/:id/return",
  authorize("admin", "receptionist"),
  validateObjectIdParam("id"),
  controller.returnToWaiting
);
router.patch(
  "/:id/remove",
  authorize("admin", "receptionist"),
  validateObjectIdParam("id"),
  validateQueueRemoval,
  controller.removeEntry
);

module.exports = router;
