const { configureCloudinary } = require("../config/cloudinary");
const AppError = require("../utils/AppError");

const ensureCloudinaryConfigured = () => {
  const required = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  if (required.some((name) => !process.env[name])) {
    throw new AppError("Image storage is not configured", 503);
  }
};

const logCloudinaryError = (operation, error) => {
  if (process.env.NODE_ENV !== "production") {
    console.error(`Cloudinary ${operation} failed`, {
      name: error?.name || "Error",
      message: error?.message || "Unknown Cloudinary error",
      httpCode: error?.http_code || null,
    });
  }
};

const uploadDoctorImage = (buffer) => {
  ensureCloudinaryConfigured();
  const cloudinary = configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "maxicare/doctors",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          logCloudinaryError("doctor image upload", error);
          return reject(new AppError("Unable to upload profile image", 502));
        }
        if (!result?.secure_url || !result?.public_id) {
          logCloudinaryError("doctor image upload", {
            message: "Cloudinary returned an incomplete upload response",
          });
          return reject(new AppError("Unable to upload profile image", 502));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.on("error", (error) => {
      logCloudinaryError("doctor image stream", error);
      reject(new AppError("Unable to upload profile image", 502));
    });
    stream.end(buffer);
  });
};

const deleteImage = async (publicId) => {
  if (!publicId) return;
  ensureCloudinaryConfigured();
  const cloudinary = configureCloudinary();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
};

module.exports = { uploadDoctorImage, deleteImage };
