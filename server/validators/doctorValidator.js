const mongoose = require("mongoose");

const namePattern = /^[\p{L}\s'-]+$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobilePattern = /^09\d{9}$/;
const clean = (value) => (typeof value === "string" ? value.trim() : "");

const validateDoctor = (req, res, next) => {
  const body = req.body || {};
  const doctor = {
    firstName: clean(body.firstName),
    middleName: clean(body.middleName),
    lastName: clean(body.lastName),
    email: clean(body.email).toLowerCase(),
    mobileNumber: clean(body.mobileNumber),
    licenseNumber: clean(body.licenseNumber).toUpperCase(),
    specialization: clean(body.specialization),
    serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds : [],
    status: clean(body.status) || "active",
  };

  const validName = (value, required = true) =>
    (!required && !value) ||
    (value.length >= 2 && value.length <= 50 && namePattern.test(value));

  if (!validName(doctor.firstName) || !validName(doctor.lastName) || !validName(doctor.middleName, false)) {
    return res.status(400).json({ message: "Please provide valid doctor names" });
  }
  if (!emailPattern.test(doctor.email)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }
  if (!mobilePattern.test(doctor.mobileNumber)) {
    return res.status(400).json({ message: "Mobile number must be 11 digits and start with 09" });
  }
  if (!doctor.licenseNumber || doctor.licenseNumber.length > 50) {
    return res.status(400).json({ message: "License number is required" });
  }
  if (!doctor.specialization || doctor.specialization.length > 100) {
    return res.status(400).json({ message: "Specialization is required" });
  }
  if (doctor.serviceIds.length === 0 || doctor.serviceIds.some((id) => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: "Select at least one valid service" });
  }
  doctor.serviceIds = [...new Set(doctor.serviceIds.map(String))];
  if (!["active", "inactive"].includes(doctor.status)) {
    return res.status(400).json({ message: "Invalid doctor status" });
  }

  if (req.method === "POST") {
    const temporaryPassword = typeof body.temporaryPassword === "string" ? body.temporaryPassword : "";
    if (temporaryPassword.length < 8 || temporaryPassword.length > 16) {
      return res.status(400).json({ message: "Temporary password must be 8 to 16 characters" });
    }
    doctor.temporaryPassword = temporaryPassword;
  }

  req.validatedDoctor = doctor;
  next();
};

module.exports = { validateDoctor };
