const service = require("../services/consultationService");

const listConsultations = async (req, res, next) => {
  try {
    res.json(await service.listConsultations(req.user, {
      ...req.query,
      status: req.consultationStatus,
    }));
  } catch (error) {
    next(error);
  }
};

const startConsultation = async (req, res, next) => {
  try {
    const data = await service.startConsultation(
      req.params.queueEntryId,
      req.user,
      req
    );
    res.status(201).json({ message: "Consultation started.", data });
  } catch (error) {
    next(error);
  }
};

const getConsultation = async (req, res, next) => {
  try {
    res.json({ data: await service.getConsultation(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
};

const saveDraft = async (req, res, next) => {
  try {
    const data = await service.saveDraft(
      req.params.id,
      req.user,
      req.validatedConsultationDraft
    );
    res.json({ message: "Consultation draft saved.", data });
  } catch (error) {
    next(error);
  }
};

const completeConsultation = async (req, res, next) => {
  try {
    const data = await service.completeConsultation(
      req.params.id,
      req.user,
      req.validatedConsultationDraft,
      req
    );
    res.json({ message: "Consultation completed.", data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listConsultations,
  startConsultation,
  getConsultation,
  saveDraft,
  completeConsultation,
};
