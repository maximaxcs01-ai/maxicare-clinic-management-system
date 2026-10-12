const patientService = require("../services/patientService");

const getPatients = async (req, res, next) => {
  try {
    const patients = await patientService.findPatients();
    res.status(200).json({ patients });
  } catch (error) {
    next(error);
  }
};

const getPatientById = async (req, res, next) => {
  try {
    const patient = await patientService.findPatientById(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    res.status(200).json({ patient });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({ message: "Patient not found" });
    }
    next(error);
  }
};

const createPatient = async (req, res, next) => {
  try {
    const patient = await patientService.createPatient(req.validatedPatient);
    res.status(201).json({ message: "Patient created successfully", patient });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Invalid patient data" });
    }
    next(error);
  }
};

const updatePatient = async (req, res, next) => {
  try {
    const patient = await patientService.updatePatient(
      req.params.id,
      req.validatedPatient
    );
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    res.status(200).json({ message: "Patient updated successfully", patient });
  } catch (error) {
    if (error.name === "CastError" && error.path === "_id") {
      return res.status(404).json({ message: "Patient not found" });
    }
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: "Invalid patient data" });
    }
    next(error);
  }
};

const deletePatient = async (req, res, next) => {
  try {
    const patient = await patientService.deletePatient(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    res.status(200).json({ message: "Patient deleted successfully" });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({ message: "Patient not found" });
    }
    next(error);
  }
};

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
};
