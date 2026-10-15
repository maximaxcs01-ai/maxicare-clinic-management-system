const multer = require("multer");
const AppError = require("../utils/AppError");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        new AppError("Profile photo must be a JPEG, PNG, or WebP image", 400)
      );
    }
    callback(null, true);
  },
}).single("profileImage");

const hasValidImageSignature = (file) => {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer)) return false;

  if (
    file.mimetype === "image/jpeg" &&
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return true;
  }
  if (
    file.mimetype === "image/png" &&
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return true;
  }
  return (
    file.mimetype === "image/webp" &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
};

const validateProfileImageFile = (file) => {
  if (!file) return new AppError("Select a profile photo to upload", 400);
  if (!Number.isFinite(file.size) || file.size < 0) {
    return new AppError("Unable to validate the profile photo size", 400);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return new AppError("Profile photo must not exceed 5 MB", 400);
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    return new AppError("Profile photo must be a JPEG, PNG, or WebP image", 400);
  }
  if (!hasValidImageSignature(file)) {
    return new AppError("Profile photo contents do not match its file type", 400);
  }
  return null;
};

const uploadProfileImage = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) {
      const validationError = validateProfileImageFile(req.file);
      return validationError ? next(validationError) : next();
    }
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("Profile photo must not exceed 5 MB", 400));
      }
      return next(new AppError("Unable to process the profile photo", 400));
    }
    next(error);
  });
};

module.exports = {
  uploadProfileImage,
  uploadDoctorImage: uploadProfileImage,
  validateProfileImageFile,
  hasValidImageSignature,
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
};
