const express = require("express");
const controller = require("../controllers/reportController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/", protect, authorize("admin"), controller.getReports);

module.exports = router;
