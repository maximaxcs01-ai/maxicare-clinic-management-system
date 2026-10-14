const service = require("../services/patientRecordsService");

const getPatientHistory = async (req, res, next) => {
  try {
    res.json({ data: await service.getPatientHistory(req.user) });
  } catch (error) {
    next(error);
  }
};

const getOwnCompletedConsultation = async (req, res, next) => {
  try {
    res.json({
      data: await service.getOwnCompletedConsultation(
        req.params.consultationId,
        req.user
      ),
    });
  } catch (error) {
    next(error);
  }
};

const listDoctorPatients = async (req, res, next) => {
  try {
    res.json({ data: await service.listDoctorPatients(req.user, req.query) });
  } catch (error) {
    next(error);
  }
};

const getDoctorPatientRecord = async (req, res, next) => {
  try {
    res.json({
      data: await service.getDoctorPatientRecord(req.params.patientId, req.user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPatientHistory,
  getOwnCompletedConsultation,
  listDoctorPatients,
  getDoctorPatientRecord,
};
