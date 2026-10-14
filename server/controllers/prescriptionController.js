const service = require("../services/prescriptionService");
const { recordRequestAudit } = require("../services/auditService");

const listPrescriptions = async (req, res, next) => {
  try {
    res.json(
      await service.listPrescriptions(req.user, {
        ...req.query,
        status: req.prescriptionStatus,
      })
    );
  } catch (error) {
    next(error);
  }
};

const createPrescription = async (req, res, next) => {
  try {
    const data = await service.createPrescription(
      req.params.consultationId,
      req.user
    );
    await recordRequestAudit(req, {
      action: "prescription.created",
      entityType: "Prescription",
      entityId: data._id,
      patientId: data.patientId?._id || data.patientId,
      description: "Prescription draft created.",
      metadata: { patientId: data.patientId?._id || data.patientId, consultationId: data.consultationId?._id || data.consultationId, status: data.status },
    });
    res.status(201).json({ message: "Prescription draft created.", data });
  } catch (error) {
    next(error);
  }
};

const getPrescriptionForConsultation = async (req, res, next) => {
  try {
    res.json({
      data: await service.getPrescriptionForConsultation(
        req.params.consultationId,
        req.user
      ),
    });
  } catch (error) {
    next(error);
  }
};

const getPrescription = async (req, res, next) => {
  try {
    res.json({ data: await service.getPrescription(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
};

const saveDraft = async (req, res, next) => {
  try {
    const data = await service.saveDraft(
      req.params.id,
      req.user,
      req.validatedPrescription
    );
    await recordRequestAudit(req, {
      action: "prescription.draft_updated",
      entityType: "Prescription",
      entityId: data._id,
      patientId: data.patientId?._id || data.patientId,
      description: "Prescription draft updated.",
      metadata: { patientId: data.patientId?._id || data.patientId, consultationId: data.consultationId?._id || data.consultationId, status: data.status },
    });
    res.json({ message: "Prescription draft saved.", data });
  } catch (error) {
    next(error);
  }
};

const issuePrescription = async (req, res, next) => {
  try {
    const data = await service.issuePrescription(
      req.params.id,
      req.user,
      req.validatedPrescription
    );
    await recordRequestAudit(req, {
      action: "prescription.issued",
      entityType: "Prescription",
      entityId: data._id,
      patientId: data.patientId?._id || data.patientId,
      description: "Prescription issued.",
      metadata: { patientId: data.patientId?._id || data.patientId, consultationId: data.consultationId?._id || data.consultationId, status: data.status },
    });
    res.json({ message: "Prescription issued.", data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listPrescriptions,
  createPrescription,
  getPrescriptionForConsultation,
  getPrescription,
  saveDraft,
  issuePrescription,
};
