const express = require("express");
const controller = require("../controllers/doctorController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { uploadDoctorImage } = require("../middleware/doctorImageUpload");
const { validateDoctor } = require("../validators/doctorValidator");

const router = express.Router();
router.use(protect);
router.get("/", controller.listDoctors);
router.post("/", authorize("admin"), validateDoctor, controller.createDoctor);
router.get("/me", authorize("doctor"), controller.getMyDoctor);
router.patch(
  "/me/profile-image",
  authorize("doctor"),
  uploadDoctorImage,
  controller.updateMyProfileImage
);
router.post("/:id/resend-invitation", authorize("admin"), controller.resendInvitation);
router.get("/:id", controller.getDoctor);
router.put("/:id", authorize("admin"), validateDoctor, controller.updateDoctor);
router.delete("/:id", authorize("admin"), controller.deleteDoctor);

module.exports = router;
