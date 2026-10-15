const service = require("../services/consultationService");
const notifications = require("../services/notificationService");

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
    await notifications.publishSafely(() =>
      notifications.notifyPatient(data.patientId?._id || data.patientId, {
        type: "consultation_completed",
        title: "Consultation Completed",
        message: "Your consultation is complete and your Visit Summary is available.",
        targetType: "patient_medical_history",
        targetId: data._id,
        dedupeKey: `consultation:${data._id}:completed`,
      })
    );
    res.json({ message: "Consultation completed.", data });
  } catch (error) {
    next(error);
  }
};

const markNoPrescriptionNeeded = async (req, res, next) => {
  try {
    const data = await service.markNoPrescriptionNeeded(
      req.params.id,
      req.user,
      req
    );
    res.json({ message: "No prescription needed decision saved.", data });
  } catch (error) {
    next(error);
  }
};

const cancelConsultation = async (req, res, next) => {
  try {
    const data = await service.cancelConsultation(
      req.params.id,
      req.user,
      req.consultationReason,
      req
    );
    res.json({ message: "Consultation cancelled and returned to the queue.", data });
  } catch (error) {
    next(error);
  }
};

const deleteConsultation = async (req, res, next) => {
  try {
    const data = await service.deleteConsultation(
      req.params.id,
      req.user,
      req.consultationReason,
      req
    );
    res.json({ message: "Consultation deleted.", data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listConsultations,
  startConsultation,
  getConsultation,
  saveDraft,
  markNoPrescriptionNeeded,
  completeConsultation,
  cancelConsultation,
  deleteConsultation,
};
