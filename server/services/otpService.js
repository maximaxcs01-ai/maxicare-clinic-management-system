const crypto = require("node:crypto");

const AppError = require("../utils/AppError");

const OTP_VALIDITY_MS = 5 * 60 * 1000;
const PENDING_VALIDITY_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RESET_TOKEN_VALIDITY_MS = 10 * 60 * 1000;

const requireOtpSecret = () => {
  if (!process.env.OTP_HASH_SECRET) {
    throw new AppError("Email verification is not configured", 503);
  }

  return process.env.OTP_HASH_SECRET;
};

const generateOtp = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const generateResetToken = () => crypto.randomBytes(32).toString("base64url");

const hashValue = (purpose, email, value) =>
  crypto
    .createHmac("sha256", requireOtpSecret())
    .update(`${purpose}:${email}:${value}`)
    .digest("hex");

const hashOtp = (email, otp) =>
  crypto
    .createHmac("sha256", requireOtpSecret())
    .update(`${email}:${otp}`)
    .digest("hex");

const verifyOtpHash = (email, otp, storedHash) => {
  const suppliedHash = Buffer.from(hashOtp(email, otp), "hex");
  const expectedHash = Buffer.from(storedHash || "", "hex");

  return (
    suppliedHash.length === expectedHash.length &&
    crypto.timingSafeEqual(suppliedHash, expectedHash)
  );
};

const verifyHash = (suppliedHash, storedHash) => {
  const supplied = Buffer.from(suppliedHash, "hex");
  const expected = Buffer.from(storedHash || "", "hex");

  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
};

const hashResetOtp = (email, otp) => hashValue("password-reset-otp", email, otp);

const verifyResetOtpHash = (email, otp, storedHash) =>
  verifyHash(hashResetOtp(email, otp), storedHash);

const hashResetToken = (email, token) =>
  hashValue("password-reset-token", email, token);

const verifyResetTokenHash = (email, token, storedHash) =>
  verifyHash(hashResetToken(email, token), storedHash);

module.exports = {
  OTP_VALIDITY_MS,
  PENDING_VALIDITY_MS,
  RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  RESET_TOKEN_VALIDITY_MS,
  generateOtp,
  generateResetToken,
  hashOtp,
  verifyOtpHash,
  hashResetOtp,
  verifyResetOtpHash,
  hashResetToken,
  verifyResetTokenHash,
  requireOtpSecret,
};
