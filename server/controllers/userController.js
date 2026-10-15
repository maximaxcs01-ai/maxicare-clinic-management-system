const service = require("../services/userService");
const { recordRequestAudit } = require("../services/auditService");
const profileService = require("../services/userProfileService");

const listUsers = async (req, res, next) => { try { res.json(await service.listUsers(req.query)); } catch (e) { next(e); } };
const getUser = async (req, res, next) => { try { const data = await service.getUser(req.params.id); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ data }); } catch (e) { next(e); } };
const createUser = async (req, res, next) => { try { const data = await service.createUser(req.validatedUser); await recordRequestAudit(req, { action: "user.created", entityType: "User", entityId: data._id, description: "Staff user account created.", metadata: { userId: data._id, status: data.status } }); res.status(201).json({ message: "Staff account created and temporary password emailed", data }); } catch (e) { next(e); } };
const reissueTemporaryPassword = async (req, res, next) => { try { const data = await service.reissueTemporaryPassword(req.params.id, req.user._id); if (!data) return res.status(404).json({ message: "User not found" }); await recordRequestAudit(req, { action: "user.temporary_password_reissued", entityType: "User", entityId: data._id, description: "Staff temporary password reissued.", metadata: { userId: data._id } }); res.json({ message: "A new temporary password was emailed successfully", data }); } catch (e) { next(e); } };
const updateUser = async (req, res, next) => { try { const data = await service.updateUser(req.params.id, req.validatedUser); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ message: "User updated successfully", data }); } catch (e) { next(e); } };
const updateStatus = async (req, res, next) => { try { const previous = await service.getUser(req.params.id); const data = await service.updateStatus(req.params.id, req.validatedStatus, req.user._id); if (!data) return res.status(404).json({ message: "User not found" }); await recordRequestAudit(req, { action: "user.status_updated", entityType: "User", entityId: data._id, description: "User account status updated.", metadata: { userId: data._id, fromStatus: previous?.status, toStatus: data.status } }); res.json({ message: "User status updated successfully", data }); } catch (e) { next(e); } };
const updateRole = async (req, res, next) => { try { const data = await service.updateRole(req.params.id, req.validatedRole, req.user._id); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ message: "User role updated successfully", data }); } catch (e) { next(e); } };
const deleteUser = async (req, res, next) => { try { const data = await service.deleteUser(req.params.id, req.user._id); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ message: "User deleted successfully" }); } catch (e) { next(e); } };

const updateOwnProfileImage = async (req, res, next) => {
  try {
    const data = await profileService.updateOwnProfileImage(
      req.user._id,
      req.user.role,
      req.file
    );
    await recordRequestAudit(req, {
      action: "user.profile_image_updated",
      entityType: "User",
      entityId: req.user._id,
      description: "Account profile image updated.",
      metadata: { userId: req.user._id },
    });
    res.json({ message: "Profile photo updated successfully", data });
  } catch (error) {
    next(error);
  }
};

module.exports = { listUsers, getUser, createUser, reissueTemporaryPassword, updateUser, updateStatus, updateRole, deleteUser, updateOwnProfileImage };
