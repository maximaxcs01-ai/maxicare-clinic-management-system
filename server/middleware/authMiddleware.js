const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Not authorized, no token",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Not authorized, no token",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }

  try {
    const user = await User.findById(decoded.id).select(
      "-password +tokenVersion"
    );

    if (!user) {
      return res.status(401).json({
        message: "Not authorized, token failed",
      });
    }

    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        message: "Not authorized, token failed",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account is inactive",
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        message: "Email verification required",
      });
    }

    req.user = user;

    const requestPath = req.originalUrl.split("?")[0].replace(/\/$/, "");
    const passwordSetupAllowed = new Set([
      "/api/auth/me",
      "/api/auth/complete-password-setup",
    ]);
    if (
      user.requiresPasswordChange === true &&
      !passwordSetupAllowed.has(requestPath)
    ) {
      return res.status(403).json({
        message: "You must change your temporary password before continuing.",
        code: "PASSWORD_CHANGE_REQUIRED",
        mustChangePassword: true,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      message: "Not authorized for this action",
    });
  }

  next();
};

module.exports = {
  protect,
  authorize,
};
