const service = require("../services/doctorService");
const AppError = require("../utils/AppError");

const listDoctors = async (req, res, next) => { try { res.json(await service.listDoctors(req.query, req.user.role)); } catch (e) { next(e); } };
const getDoctor = async (req, res, next) => { try { const data = await service.getDoctor(req.params.id, req.user.role); if (!data) return res.status(404).json({ message: "Doctor not found" }); res.json({ data }); } catch (e) { next(e); } };
const getMyDoctor = async (req, res, next) => { try { const data = await service.getMyDoctor(req.user._id); if (!data) return res.status(404).json({ message: "Doctor profile not found" }); res.json({ data }); } catch (e) { next(e); } };
const updateMyProfileImage = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      throw new AppError("Select a profile photo to upload", 400);
    }
    const data = await service.updateMyProfileImage(req.user._id, req.file);
    await recordRequestAudit(req, {
      action: "doctor.profile_image_updated",
      entityType: "Doctor",
      entityId: data._id,
      description: "Doctor profile image updated.",
      metadata: { doctorId: data._id },
    });
    res.json({ message: "Profile photo updated successfully", data });
  } catch (error) {
    next(error);
  }
};
const createDoctor = async (req, res, next) => { try { const data = await service.createDoctor(req.validatedDoctor, req.user, req); res.status(201).json({ message: "Doctor created successfully", data: data.doctor }); } catch (e) { next(e); } };
const updateDoctor = async (req, res, next) => { try { const data = await service.updateDoctor(req.params.id, req.validatedDoctor); if (!data) return res.status(404).json({ message: "Doctor not found" }); res.json({ message: "Doctor updated successfully", data }); } catch (e) { next(e); } };
const deleteDoctor = async (req, res, next) => { try { await recordRequestAudit(req, { action: "doctor.delete_attempted", entityType: "Doctor", entityId: req.params.id, description: "Doctor deletion attempted.", metadata: { doctorId: req.params.id } }); const deleted = await service.deleteDoctor(req.params.id); if (!deleted) return res.status(404).json({ message: "Doctor not found" }); res.json({ message: "Doctor deleted successfully" }); } catch (e) { next(e); } };
const resendInvitation = async (req, res, next) => { try { const result = await service.resendInvitation(req.params.id); await recordRequestAudit(req, { action: "doctor.invitation_resent", entityType: "Doctor", entityId: req.params.id, description: "Doctor account setup invitation resent.", metadata: { doctorId: req.params.id } }); res.status(200).json(result); } catch (e) { next(e); } };

module.exports = { listDoctors, getDoctor, getMyDoctor, updateMyProfileImage, createDoctor, updateDoctor, deleteDoctor, resendInvitation };
