const express = require("express");
const controller = require("../controllers/serviceController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateService } = require("../validators/serviceValidator");

const router = express.Router();
router.use(protect);
router.get("/", controller.listServices);
router.post("/", authorize("admin"), validateService, controller.createService);
router.get("/:id", controller.getService);
router.put("/:id", authorize("admin"), validateService, controller.updateService);
router.delete("/:id", authorize("admin"), controller.deleteService);

module.exports = router;
