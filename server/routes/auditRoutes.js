const express = require("express");
const controller = require("../controllers/auditController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/", protect, authorize("admin"), controller.getAuditLogs);

module.exports = router;
