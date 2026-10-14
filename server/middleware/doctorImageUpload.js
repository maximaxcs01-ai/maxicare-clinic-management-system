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

const uploadDoctorImage = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("Profile photo must not exceed 5 MB", 400));
      }
      return next(new AppError("Unable to process the profile photo", 400));
    }
    next(error);
  });
};

module.exports = { uploadDoctorImage, MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES };
