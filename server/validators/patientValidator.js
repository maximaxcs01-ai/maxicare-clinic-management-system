const { isCityInProvince } = require("../data/philippineLocations");

const namePattern = /^[\p{L}\s'-]+$/u;
const mobilePattern = /^09\d{9}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value) => (typeof value === "string" ? value.trim() : "");

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date <= new Date();
};

const buildPatient = (body = {}) => ({
  firstName: clean(body.firstName), middleName: clean(body.middleName),
  lastName: clean(body.lastName), suffix: clean(body.suffix),
  dateOfBirth: body.dateOfBirth, sex: clean(body.sex || body.gender),
  gender: clean(body.sex || body.gender), email: clean(body.email).toLowerCase(),
  mobileNumber: clean(body.mobileNumber || body.contactNumber),
  contactNumber: clean(body.mobileNumber || body.contactNumber),
  address: {
    street: clean(body.address?.street), barangay: clean(body.address?.barangay),
    city: clean(body.address?.city), province: clean(body.address?.province),
    zipCode: clean(body.address?.zipCode),
  },
  emergencyContact: {
    firstName: clean(body.emergencyContact?.firstName),
    lastName: clean(body.emergencyContact?.lastName),
    relationship: clean(body.emergencyContact?.relationship),
    mobileNumber: clean(body.emergencyContact?.mobileNumber),
  },
  medicalSummary: {
    bloodType: clean(body.medicalSummary?.bloodType),
    allergies: clean(body.medicalSummary?.allergies),
    existingConditions: clean(body.medicalSummary?.existingConditions),
  },
  portalStatus: clean(body.portalStatus) || "not_activated",
});

const validateNames = (data) => {
  for (const [label, value, required] of [
    ["First name", data.firstName, true], ["Middle name", data.middleName, false],
    ["Last name", data.lastName, true],
  ]) {
    if (required && !value) return `${label} is required`;
    if (value && (value.length < 2 || value.length > 50 || !namePattern.test(value))) return `${label} is invalid`;
  }
  return null;
};

const validatePatientData = (data, complete) => {
  const nameError = validateNames(data);
  if (nameError) return nameError;
  if (complete && !validDate(data.dateOfBirth)) return "Please enter a valid date of birth that is not in the future";
  if (data.dateOfBirth && !validDate(data.dateOfBirth)) return "Invalid date of birth";
  if (complete && !["Male", "Female"].includes(data.sex)) return "Sex must be Male or Female";
  if (data.sex && !["Male", "Female"].includes(data.sex)) return "Sex must be Male or Female";
  if (!emailPattern.test(data.email)) return "Please enter a valid email address";
  if (complete && !mobilePattern.test(data.mobileNumber)) return "Mobile number must be 11 digits and start with 09";
  if (data.mobileNumber && !mobilePattern.test(data.mobileNumber)) return "Invalid mobile number";
  if (complete && (!data.address.street || !data.address.barangay || !data.address.city || !data.address.province)) return "Please complete all required address fields";
  if (data.address.city && data.address.province && !isCityInProvince(data.address.province, data.address.city)) return "City or municipality does not match the selected province";
  if (data.emergencyContact.mobileNumber && !mobilePattern.test(data.emergencyContact.mobileNumber)) return "Invalid emergency contact mobile number";
  if (!["not_activated", "invited", "active", "inactive"].includes(data.portalStatus)) return "Invalid portal status";
  return null;
};

const validatePatient = (req, res, next) => {
  const data = buildPatient(req.body);
  const error = validatePatientData(data, true);
  if (error) return res.status(400).json({ message: error });
  req.validatedPatient = data;
  next();
};

const validateOwnPatient = (req, res, next) => {
  const data = buildPatient(req.body);
  const error = validatePatientData(data, false);
  if (error) return res.status(400).json({ message: error });
  delete data.portalStatus;
  req.validatedPatient = data;
  next();
};

const validateWalkInPatient = (body = {}) => {
  const firstName = clean(body.firstName);
  const middleName = clean(body.middleName);
  const lastName = clean(body.lastName);
  const email = clean(body.email).toLowerCase();
  const mobileNumber = clean(body.mobileNumber || body.contactNumber);

  const data = {
    firstName,
    middleName,
    lastName,
    email,
    portalStatus: "not_activated",
  };
  if (mobileNumber) {
    data.mobileNumber = mobileNumber;
    data.contactNumber = mobileNumber;
  }

  const nameError = validateNames(data);
  if (nameError) return { error: nameError };
  if (!emailPattern.test(email)) return { error: "Please enter a valid email address" };
  if (mobileNumber && !mobilePattern.test(mobileNumber)) {
    return { error: "Mobile number must be 11 digits and start with 09" };
  }
  return { data };
};

const validateWalkInPatientBody = (req, res, next) => {
  const result = validateWalkInPatient(req.body);
  if (result.error) return res.status(400).json({ message: result.error });
  req.validatedWalkInPatient = result.data;
  next();
};

module.exports = {
  validatePatient,
  validateOwnPatient,
  validateWalkInPatient,
  validateWalkInPatientBody,
};
