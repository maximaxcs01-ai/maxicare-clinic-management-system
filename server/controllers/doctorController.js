const service = require("../services/doctorService");

const listDoctors = async (req, res, next) => { try { res.json(await service.listDoctors(req.query, req.user.role)); } catch (e) { next(e); } };
const getDoctor = async (req, res, next) => { try { const data = await service.getDoctor(req.params.id, req.user.role); if (!data) return res.status(404).json({ message: "Doctor not found" }); res.json({ data }); } catch (e) { next(e); } };
const getMyDoctor = async (req, res, next) => { try { const data = await service.getMyDoctor(req.user._id); if (!data) return res.status(404).json({ message: "Doctor profile not found" }); res.json({ data }); } catch (e) { next(e); } };
const createDoctor = async (req, res, next) => { try { const data = await service.createDoctor(req.validatedDoctor); res.status(201).json({ message: "Doctor created successfully", data }); } catch (e) { next(e); } };
const updateDoctor = async (req, res, next) => { try { const data = await service.updateDoctor(req.params.id, req.validatedDoctor); if (!data) return res.status(404).json({ message: "Doctor not found" }); res.json({ message: "Doctor updated successfully", data }); } catch (e) { next(e); } };
const deleteDoctor = async (req, res, next) => { try { const deleted = await service.deleteDoctor(req.params.id); if (!deleted) return res.status(404).json({ message: "Doctor not found" }); res.json({ message: "Doctor deleted successfully" }); } catch (e) { next(e); } };
const resendInvitation = async (req, res, next) => { try { const result = await service.resendInvitation(req.params.id); res.status(200).json(result); } catch (e) { next(e); } };

module.exports = { listDoctors, getDoctor, getMyDoctor, createDoctor, updateDoctor, deleteDoctor, resendInvitation };
