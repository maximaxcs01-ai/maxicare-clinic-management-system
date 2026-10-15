const express = require("express");
const controller = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { uploadProfileImage } = require("../middleware/doctorImageUpload");
const { validateCreateUser, validateUpdateUser, validateStatus, validateRole } = require("../validators/userValidator");

const router = express.Router();
router.patch(
  "/me/profile-image",
  protect,
  authorize("patient", "receptionist", "admin"),
  uploadProfileImage,
  controller.updateOwnProfileImage
);
router.use(protect, authorize("admin"));
router.get("/", controller.listUsers);
router.post("/", validateCreateUser, controller.createUser);
router.get("/:id", controller.getUser);
router.put("/:id", validateUpdateUser, controller.updateUser);
router.patch("/:id/status", validateStatus, controller.updateStatus);
router.patch("/:id/role", validateRole, controller.updateRole);
router.delete("/:id", controller.deleteUser);

module.exports = router;
