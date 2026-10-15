const User = require("../models/User");
const AppError = require("../utils/AppError");
const cloudinaryService = require("./cloudinaryService");
const {
  validateProfileImageFile,
} = require("../middleware/doctorImageUpload");

const SELF_PROFILE_ROLES = new Set(["patient", "receptionist", "admin"]);

const updateOwnProfileImage = async (userId, role, file) => {
  if (!SELF_PROFILE_ROLES.has(role)) {
    throw new AppError("Not authorized for this action", 403);
  }
  const fileError = validateProfileImageFile(file);
  if (fileError) {
    throw fileError;
  }

  const existingUser = await User.findById(userId).select(
    "+profileImage.publicId"
  );
  if (!existingUser) {
    throw new AppError("User not found", 404);
  }

  const uploadedImage = await cloudinaryService.uploadProfileImage(
    file.buffer,
    `maxicare/users/${role}`
  );
  let updatedUser;

  try {
    updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { profileImage: uploadedImage } },
      { new: true, runValidators: true }
    ).select("-password -tokenVersion -profileImage.publicId");

    if (!updatedUser) {
      throw new AppError("User not found", 404);
    }
  } catch (error) {
    try {
      await cloudinaryService.deleteImage(uploadedImage.publicId);
    } catch (cleanupError) {
      console.error("Unable to clean up an unused profile image");
    }
    throw error;
  }

  const previousPublicId = existingUser.profileImage?.publicId;
  if (previousPublicId && previousPublicId !== uploadedImage.publicId) {
    try {
      await cloudinaryService.deleteImage(previousPublicId);
    } catch (error) {
      console.error("Unable to delete the previous profile image");
    }
  }

  return updatedUser;
};

module.exports = { updateOwnProfileImage };
