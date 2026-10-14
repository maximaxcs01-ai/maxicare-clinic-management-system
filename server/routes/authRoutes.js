const express = require("express");
const {
  registerUser,
  verifyEmail,
  resendOtp,
  loginUser,
  getCurrentUser,
  forgotPassword,
  resendResetOtp,
  verifyResetOtp,
  updatePassword,
  validateAccountSetupToken,
  setAccountPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateRegistration,
  validateEmailOtp,
  validateResendOtp,
  validateResetPassword,
  validateAccountSetupToken: validateSetupQuery,
  validateAccountSetupPassword,
} = require("../validators/authValidator");

const router = express.Router();

router.post("/register", validateRegistration, registerUser);
router.post("/verify-email", validateEmailOtp, verifyEmail);
router.post("/resend-otp", validateResendOtp, resendOtp);
router.post("/login", loginUser);
router.post("/forgot-password", validateResendOtp, forgotPassword);
router.post("/verify-reset-otp", validateEmailOtp, verifyResetOtp);
router.post("/resend-reset-otp", validateResendOtp, resendResetOtp);
router.post("/reset-password", validateResetPassword, updatePassword);
router.get("/account-setup/validate", validateSetupQuery, validateAccountSetupToken);
router.post("/account-setup", validateAccountSetupPassword, setAccountPassword);
router.get("/me", protect, getCurrentUser);

module.exports = router;
