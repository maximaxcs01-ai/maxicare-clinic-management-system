const express = require("express");
const controller = require("../controllers/walkInController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validateWalkIn,
  validateWalkInServiceQuery,
} = require("../validators/walkInValidator");

const router = express.Router();
router.use(protect, authorize("admin", "receptionist"));
router.get("/next-doctor", validateWalkInServiceQuery, controller.getNextDoctor);
router.post("/", validateWalkIn, controller.createWalkIn);

module.exports = router;
