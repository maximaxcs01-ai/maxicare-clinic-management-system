const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^[\p{L}\s'-]+$/u;
const clean = (value) => (typeof value === "string" ? value.trim() : "");

const getBaseUser = (body = {}) => ({
  firstName: clean(body.firstName),
  middleName: clean(body.middleName),
  lastName: clean(body.lastName),
  email: clean(body.email).toLowerCase(),
});

const validateBase = (user) => {
  const names = [user.firstName, user.lastName];
  if (user.middleName) names.push(user.middleName);
  if (names.some((name) => name.length < 2 || name.length > 50 || !namePattern.test(name))) {
    return "Please provide valid names";
  }
  if (!emailPattern.test(user.email)) return "Please enter a valid email address";
  return null;
};

const validateCreateUser = (req, res, next) => {
  const user = getBaseUser(req.body);
  const error = validateBase(user);
  if (error) return res.status(400).json({ message: error });
  const role = clean(req.body?.role);
  const status = clean(req.body?.status) || "active";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!["receptionist", "admin"].includes(role)) {
    return res.status(400).json({ message: "Create doctors through Doctor Management; patients must self-register" });
  }
  if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Invalid user status" });
  if (password.length < 8 || password.length > 16) return res.status(400).json({ message: "Password must be 8 to 16 characters" });
  req.validatedUser = { ...user, role, status, password };
  next();
};

const validateUpdateUser = (req, res, next) => {
  const user = getBaseUser(req.body);
  const error = validateBase(user);
  if (error) return res.status(400).json({ message: error });
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password && (password.length < 8 || password.length > 16)) return res.status(400).json({ message: "Password must be 8 to 16 characters" });
  req.validatedUser = { ...user, ...(password ? { password } : {}) };
  next();
};

const validateStatus = (req, res, next) => {
  if (!["active", "inactive"].includes(req.body?.status)) return res.status(400).json({ message: "Invalid user status" });
  req.validatedStatus = req.body.status;
  next();
};

const validateRole = (req, res, next) => {
  if (!["receptionist", "admin"].includes(req.body?.role)) return res.status(400).json({ message: "Only standalone staff roles may be assigned here" });
  req.validatedRole = req.body.role;
  next();
};

module.exports = { validateCreateUser, validateUpdateUser, validateStatus, validateRole };
