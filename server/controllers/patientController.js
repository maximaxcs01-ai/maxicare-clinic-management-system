const service = require("../services/patientService");
const portalService = require("../services/patientPortalService");

const getPatients = async (req, res, next) => { try { res.json(await service.findPatients(req.query)); } catch (e) { next(e); } };
const searchWalkInPatients = async (req, res, next) => { try { res.json(await service.searchWalkInPatients(req.query)); } catch (e) { next(e); } };
const getPatientById = async (req, res, next) => { try { const data = await service.findPatientById(req.params.id); if (!data) return res.status(404).json({ message: "Patient not found" }); res.json({ data, patient: data }); } catch (e) { next(e); } };
const getOwnPatient = async (req, res, next) => { try { const data = await service.findOwnPatient(req.user._id); if (!data) return res.status(404).json({ message: "Patient profile not found" }); res.json({ data }); } catch (e) { next(e); } };
const createPatient = async (req, res, next) => { try { const data = await service.createPatient(req.validatedPatient); res.status(201).json({ message: "Patient created successfully", data, patient: data }); } catch (e) { next(e); } };
const updatePatient = async (req, res, next) => { try { const data = await service.updatePatient(req.params.id, req.validatedPatient); if (!data) return res.status(404).json({ message: "Patient not found" }); res.json({ message: "Patient updated successfully", data, patient: data }); } catch (e) { next(e); } };
const updateOwnPatient = async (req, res, next) => { try { const data = await service.updateOwnPatient(req.user._id, req.validatedPatient); if (!data) return res.status(404).json({ message: "Patient profile not found" }); res.json({ message: "Profile updated successfully", data }); } catch (e) { next(e); } };
const deletePatient = async (req, res, next) => { try { const data = await service.deletePatient(req.params.id); if (!data) return res.status(404).json({ message: "Patient not found" }); res.json({ message: "Patient deleted successfully" }); } catch (e) { next(e); } };
const activatePatientPortal = async (req, res, next) => { try { res.status(201).json(await portalService.activatePatientPortal(req.params.id)); } catch (e) { next(e); } };
const resendPatientActivation = async (req, res, next) => { try { res.json(await portalService.resendPatientActivation(req.params.id)); } catch (e) { next(e); } };

module.exports = { getPatients, searchWalkInPatients, getPatientById, getOwnPatient, createPatient, updatePatient, updateOwnPatient, deletePatient, activatePatientPortal, resendPatientActivation };
