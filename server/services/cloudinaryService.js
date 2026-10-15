const { configureCloudinary } = require("../config/cloudinary");
const AppError = require("../utils/AppError");

const ensureCloudinaryConfigured = () => {
  const required = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missingVariables = required.filter((name) => !process.env[name]);
  if (missingVariables.length > 0) {
    console.error({
      event: "doctor_profile_image_upload_failed",
      provider: "cloudinary",
      category: "configuration",
      httpCode: null,
      errorName: "CloudinaryConfigurationError",
      safeMessage: "Required Cloudinary configuration is missing.",
      missingVariables,
    });
    throw new AppError("Image storage is not configured", 503);
  }
};

const describeCloudinaryError = (error) => {
  const httpCode = Number(error?.http_code || error?.statusCode) || null;
  const message = String(error?.message || "").toLowerCase();

  if (httpCode === 401 || httpCode === 403) {
    return {
      category: "invalid_credentials",
      safeMessage: "Cloudinary rejected the configured credentials.",
    };
  }
  if (
    message.includes("cloud_name") ||
    message.includes("api_key") ||
    message.includes("api secret")
  ) {
    return {
      category: "configuration",
      safeMessage: "Cloudinary configuration is incomplete or invalid.",
    };
  }
  if (
    error?.code === "ETIMEDOUT" ||
    error?.code === "ECONNRESET" ||
    error?.code === "ENOTFOUND" ||
    message.includes("timeout") ||
    message.includes("network")
  ) {
    return {
      category: "network",
      safeMessage: "Cloudinary could not be reached before the request ended.",
    };
  }
  if (
    httpCode === 400 &&
    (message.includes("image") ||
      message.includes("file") ||
      message.includes("resource"))
  ) {
    return {
      category: "invalid_image",
      safeMessage: "Cloudinary rejected the uploaded image.",
    };
  }
  return {
    category: "provider_rejection",
    safeMessage: "Cloudinary rejected the upload request.",
  };
};

const logCloudinaryError = (error) => {
  const description = describeCloudinaryError(error);
  console.error({
    event: "doctor_profile_image_upload_failed",
    provider: "cloudinary",
    httpCode: Number(error?.http_code || error?.statusCode) || null,
    errorName: error?.name || "CloudinaryError",
    ...description,
  });
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
          logCloudinaryError(error);
          return reject(new AppError("Unable to upload profile image", 502));
        }
        if (!result?.secure_url || !result?.public_id) {
          logCloudinaryError({
            name: "CloudinaryResponseError",
          });
          return reject(new AppError("Unable to upload profile image", 502));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
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
