const Patient = require("../models/Patient");
const { getNextPatientNumber } = require("./patientNumberService");

const findPatients = () => Patient.find().sort({ createdAt: -1 });
const findPatientById = (id) => Patient.findById(id);
const createPatient = async (patientData) => {
  const patientNumber = await getNextPatientNumber();
  return Patient.create({ ...patientData, patientNumber });
};
const updatePatient = (id, patientData) =>
  Patient.findByIdAndUpdate(id, patientData, {
    new: true,
    runValidators: true,
  });
const deletePatient = (id) => Patient.findByIdAndDelete(id);

module.exports = {
  findPatients,
  findPatientById,
  createPatient,
  updatePatient,
  deletePatient,
};
