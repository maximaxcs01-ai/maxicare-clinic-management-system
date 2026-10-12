const { isCityInProvince } = require("../data/philippineLocations");

const namePattern = /^[\p{L}\s'-]+$/u;
const contactNumberPattern = /^09\d{9}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const isValidDateOfBirth = (value) => {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    value <= todayValue
  );
};

const getPatientData = (body = {}) => ({
  firstName: cleanString(body.firstName),
  lastName: cleanString(body.lastName),
  dateOfBirth: body.dateOfBirth,
  gender: cleanString(body.gender),
  contactNumber: cleanString(body.contactNumber),
  email: cleanString(body.email).toLowerCase(),
  address: {
    street: cleanString(body.address?.street),
    barangay: cleanString(body.address?.barangay),
    city: cleanString(body.address?.city),
    province: cleanString(body.address?.province),
  },
});

const validatePatientData = (data) => {
  if (!data.firstName || !data.lastName) {
    return "First name and last name are required";
  }

  if (
    data.firstName.length < 2 ||
    data.firstName.length > 50 ||
    !namePattern.test(data.firstName)
  ) {
    return "First name must be 2 to 50 characters and use letters, spaces, hyphens, or apostrophes";
  }

  if (
    data.lastName.length < 2 ||
    data.lastName.length > 50 ||
    !namePattern.test(data.lastName)
  ) {
    return "Last name must be 2 to 50 characters and use letters, spaces, hyphens, or apostrophes";
  }

  if (!data.dateOfBirth) return "Date of birth is required";

  if (!isValidDateOfBirth(data.dateOfBirth)) {
    return "Please enter a valid date of birth that is not in the future";
  }

  if (!["Male", "Female"].includes(data.gender)) {
    return "Gender must be Male or Female";
  }

  if (!contactNumberPattern.test(data.contactNumber)) {
    return "Contact number must be 11 digits and start with 09.";
  }

  if (!emailPattern.test(data.email)) {
    return "Please enter a valid email address.";
  }

  if (
    !data.address.street ||
    !data.address.barangay ||
    !data.address.city ||
    !data.address.province
  ) {
    return "Please complete all address fields";
  }

  if (!isCityInProvince(data.address.province, data.address.city)) {
    return "City or municipality does not match the selected province.";
  }

  return null;
};

const validatePatient = (req, res, next) => {
  const patientData = getPatientData(req.body);
  const validationError = validatePatientData(patientData);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  req.validatedPatient = patientData;
  next();
};

module.exports = { validatePatient };
