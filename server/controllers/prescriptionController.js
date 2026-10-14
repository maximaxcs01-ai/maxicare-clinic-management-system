const service = require("../services/prescriptionService");

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
