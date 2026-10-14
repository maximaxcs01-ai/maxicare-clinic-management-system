const express = require("express");
const controller = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.get(
  "/",
  protect,
  authorize("patient", "receptionist", "doctor", "admin"),
  controller.getDashboard
);

module.exports = router;
