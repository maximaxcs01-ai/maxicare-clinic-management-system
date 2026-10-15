const namePattern = /^[\p{L}\s'-]+$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileNumberPattern = /^09\d{9}$/;
const { CURRENT_TERMS_VERSION } = require("../config/terms");

const cleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const validateName = (value, label, required = true) => {
  if (!value) return required ? `${label} is required` : null;
  if (value.length < 2 || value.length > 50 || !namePattern.test(value)) {
    return `${label} must be 2 to 50 characters and use letters, spaces, hyphens, or apostrophes`;
  }
  return null;
};

const validateRegistration = (req, res, next) => {
  const body = req.body || {};

  if (Object.hasOwn(body, "role")) {
    return res.status(400).json({
      message: "Role cannot be selected during public registration",
    });
  }

  if (body.termsVersion !== CURRENT_TERMS_VERSION) {
    return res.status(400).json({
      message:
        "The Terms of Service and Privacy Policy have been updated. Please review and accept the current version",
    });
  }

  if (body.termsAccepted !== true || body.privacyAccepted !== true) {
    return res.status(400).json({
      message: "You must accept the current Terms of Service and Privacy Policy",
    });
  }

  const registration = {
    firstName: cleanString(body.firstName),
    middleName: cleanString(body.middleName),
    lastName: cleanString(body.lastName),
    email: cleanString(body.email).toLowerCase(),
    mobileNumber: cleanString(body.mobileNumber),
    password: typeof body.password === "string" ? body.password : "",
    confirmPassword:
      typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    termsAccepted: true,
    privacyAccepted: true,
    termsVersion: CURRENT_TERMS_VERSION,
  };

  const validationError =
    validateName(registration.firstName, "First name") ||
    validateName(registration.middleName, "Middle name", false) ||
    validateName(registration.lastName, "Last name");

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  if (!emailPattern.test(registration.email)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }

  if (!mobileNumberPattern.test(registration.mobileNumber)) {
    return res.status(400).json({
      message: "Mobile number must be 11 digits and start with 09",
    });
  }

  if (
    registration.password.length < 8 ||
    registration.password.length > 16
  ) {
    return res.status(400).json({
      message: "Password must be 8 to 16 characters",
    });
  }

  if (registration.password !== registration.confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  delete registration.confirmPassword;
  req.validatedAuth = registration;
  next();
};

const validateEmailOtp = (req, res, next) => {
  const email = cleanString(req.body?.email).toLowerCase();
  const otp = cleanString(req.body?.otp);

  if (!emailPattern.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "Invalid email or verification code" });
  }

  req.validatedAuth = { email, otp };
  next();
};

const validateResendOtp = (req, res, next) => {
  const email = cleanString(req.body?.email).toLowerCase();

  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }

  req.validatedAuth = { email };
  next();
};

const validateResetPassword = (req, res, next) => {
  const email = cleanString(req.body?.email).toLowerCase();
  const resetToken = cleanString(req.body?.resetToken);
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword =
    typeof req.body?.confirmPassword === "string"
      ? req.body.confirmPassword
      : "";

  if (!emailPattern.test(email) || !resetToken || resetToken.length > 200) {
    return res.status(400).json({
      message: "Password reset authorization is invalid or expired",
    });
  }

  if (newPassword.length < 8 || newPassword.length > 16) {
    return res.status(400).json({
      message: "Password must be 8 to 16 characters",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  req.validatedAuth = { email, resetToken, newPassword };
  next();
};

const validateAccountSetupToken = (req, res, next) => {
  const token = cleanString(req.query?.token || req.body?.token || "");

  if (!token) {
    return res.status(400).json({
      valid: false,
      message: "This account setup link is invalid or has expired.",
    });
  }

  req.validatedAuth = { token };
  next();
};

const validateAccountSetupPassword = (req, res, next) => {
  const token = cleanString(req.body?.token || "");
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword =
    typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

  if (!token) {
    return res.status(400).json({
      message: "This account setup link is invalid or has expired.",
    });
  }

  if (newPassword.length < 8 || newPassword.length > 16) {
    return res.status(400).json({
      message: "Password must be 8 to 16 characters",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  req.validatedAuth = { token, newPassword, confirmPassword };
  next();
};

const validateTemporaryPasswordChange = (req, res, next) => {
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword =
    typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

  if (newPassword.length < 8 || newPassword.length > 16) {
    return res.status(400).json({ message: "Password must be 8 to 16 characters" });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  req.validatedAuth = { newPassword };
  next();
};

const validateAuthenticatedPasswordChange = (req, res, next) => {
  const currentPassword =
    typeof req.body?.currentPassword === "string"
      ? req.body.currentPassword
      : "";
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword =
    typeof req.body?.confirmPassword === "string"
      ? req.body.confirmPassword
      : "";

  if (!currentPassword || currentPassword.length > 128) {
    return res.status(400).json({ message: "Current password is required." });
  }
  if (newPassword.length < 8 || newPassword.length > 16) {
    return res.status(400).json({ message: "Password must be 8 to 16 characters" });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  req.validatedAuth = { currentPassword, newPassword };
  next();
};

const validateNotificationPreference = (req, res, next) => {
  if (typeof req.body?.inApp !== "boolean") {
    return res.status(400).json({
      message: "In-app notification preference must be true or false.",
    });
  }
  req.validatedNotificationPreference = { inApp: req.body.inApp };
  next();
};

module.exports = {
  validateRegistration,
  validateEmailOtp,
  validateResendOtp,
  validateResetPassword,
  validateAccountSetupToken,
  validateAccountSetupPassword,
  validateTemporaryPasswordChange,
  validateAuthenticatedPasswordChange,
  validateNotificationPreference,
};
