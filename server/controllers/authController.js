const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
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
    await verifyPendingPatient(req.validatedAuth);
    res.status(201).json({ message: "Email verified successfully." });
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

    if (user.passwordSetupRequired === true) {
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

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
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
    await completeSetup(req.validatedAuth);
    res.status(200).json({
      message: "Password set successfully. You can now log in.",
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
    },
  });
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
};
