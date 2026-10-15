const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createAuthSession } = require("../services/authSessionService");
const {
  registerPendingPatient,
  verifyPendingPatient,
  resendRegistrationOtp,
} = require("../services/authService");
const {
  requestPasswordReset,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} = require("../services/passwordResetService");
const { validateSetupToken, completeSetup } = require("../services/accountSetupService");
const { recordRequestAudit } = require("../services/auditService");
const accountSettingsService = require("../services/accountSettingsService");

const PASSWORD_RESET_SAFE_MESSAGE =
  "If an account exists for that email, a verification code has been sent.";

const registerUser = async (req, res, next) => {
  try {
    const result = await registerPendingPatient(req.validatedAuth);

    res.status(200).json({
      message: "Verification code sent.",
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const user = await verifyPendingPatient(req.validatedAuth);
    const authSession = createAuthSession(user);
    res.status(201).json({
      message: "Email verified successfully.",
      ...authSession,
    });
  } catch (error) {
    next(error);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    await resendRegistrationOtp(req.validatedAuth);
    res.status(200).json({
      message: "A new verification code has been sent.",
      email: req.validatedAuth.email,
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email }).select(
      "+password +tokenVersion"
    );

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (
      user.passwordSetupRequired === true &&
      user.requiresPasswordChange !== true
    ) {
      return res.status(403).json({
        message: "Account setup is required. Please use the invitation sent to your email.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account is inactive",
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    const authSession = createAuthSession(user);

    res.status(200).json({
      message: "Login successful",
      ...authSession,
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    await requestPasswordReset(req.validatedAuth);
    res.status(200).json({ message: PASSWORD_RESET_SAFE_MESSAGE });
  } catch (error) {
    next(error);
  }
};

const resendResetOtp = async (req, res, next) => {
  try {
    await resendPasswordResetOtp(req.validatedAuth);
    res.status(200).json({ message: PASSWORD_RESET_SAFE_MESSAGE });
  } catch (error) {
    next(error);
  }
};

const verifyResetOtp = async (req, res, next) => {
  try {
    const result = await verifyPasswordResetOtp(req.validatedAuth);
    res.status(200).json({
      message: "Verification successful. You may now reset your password.",
      resetToken: result.resetToken,
    });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    await resetPassword(req.validatedAuth);
    res.status(200).json({
      message: "Password reset successful. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};

const validateAccountSetupToken = async (req, res, next) => {
  try {
    const token = typeof req.query?.token === "string" ? req.query.token.trim() : "";
    const result = await validateSetupToken(token);
    if (result.valid) {
      return res.status(200).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    next(error);
  }
};

const setAccountPassword = async (req, res, next) => {
  try {
    await completeSetup(req.validatedAuth, req);
    res.status(200).json({
      message: "Password set successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};

const completeTemporaryPasswordSetup = async (req, res, next) => {
  try {
    if (req.user.requiresPasswordChange !== true) {
      return res.status(409).json({ message: "Password setup is already complete" });
    }

    const password = await bcrypt.hash(req.validatedAuth.newPassword, 10);
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, requiresPasswordChange: true },
      {
        $set: {
          password,
          passwordSetupRequired: false,
          requiresPasswordChange: false,
        },
        $inc: { tokenVersion: 1 },
      },
      { new: true, runValidators: true }
    ).select("+tokenVersion");

    if (!user) {
      return res.status(409).json({ message: "Password setup is already complete" });
    }

    await recordRequestAudit(req, {
      action: "password_setup.completed",
      entityType: "User",
      entityId: user._id,
      description: "Temporary password setup completed.",
      metadata: { userId: user._id },
    });

    res.status(200).json({
      message: "Password updated successfully",
      ...createAuthSession(user),
    });
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = (req, res) => {
  res.status(200).json({
    user: {
      id: req.user._id,
      firstName: req.user.firstName,
      middleName: req.user.middleName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      emailVerified: req.user.emailVerified,
      mustChangePassword: req.user.requiresPasswordChange === true,
      ...(req.user.role === "doctor"
        ? {}
        : { profileImage: req.user.profileImage }),
    },
  });
};

const getAccountSettings = async (req, res, next) => {
  try {
    res.status(200).json({
      data: await accountSettingsService.getAccountSettings(req.user._id),
    });
  } catch (error) {
    next(error);
  }
};

const updateNotificationPreference = async (req, res, next) => {
  try {
    res.status(200).json({
      data: await accountSettingsService.updateNotificationPreference(
        req.user._id,
        req.validatedNotificationPreference.inApp
      ),
    });
  } catch (error) {
    next(error);
  }
};

const changeAuthenticatedPassword = async (req, res, next) => {
  try {
    const user = await accountSettingsService.changePassword(
      req.user._id,
      req.validatedAuth
    );
    res.status(200).json({
      message: "Password changed successfully.",
      ...createAuthSession(user),
    });
  } catch (error) {
    next(error);
  }
};

const logoutAllDevices = async (req, res, next) => {
  try {
    await accountSettingsService.signOutAllDevices(req.user._id);
    res.status(200).json({ message: "All sessions have been signed out." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
  completeTemporaryPasswordSetup,
  getAccountSettings,
  updateNotificationPreference,
  changeAuthenticatedPassword,
  logoutAllDevices,
};
