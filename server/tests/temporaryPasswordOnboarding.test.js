const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { completeTemporaryPasswordSetup, loginUser } = require("../controllers/authController");
const { createAuthSession } = require("../services/authSessionService");
const { generateTemporaryPassword } = require("../services/temporaryPasswordService");
const { createUser } = require("../services/userService");
const { protect } = require("../middleware/authMiddleware");
const { validateTemporaryPasswordChange } = require("../validators/authValidator");

const withJwtSecret = async (callback) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "temporary-password-test-secret";
  try { return await callback(); }
  finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
};

const runPasswordValidator = (body) => {
  let statusCode;
  let payload;
  let nextCalled = false;
  const req = { body };
  validateTemporaryPasswordChange(req, {
    status(code) { statusCode = code; return this; },
    json(bodyValue) { payload = bodyValue; return this; },
  }, () => { nextCalled = true; });
  return { req, statusCode, payload, nextCalled };
};

const runProtect = async ({ user, url }) => withJwtSecret(async () => {
  const originalFindById = User.findById;
  User.findById = () => ({ select: async () => user });
  const token = jwt.sign(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET
  );
  let statusCode;
  let payload;
  let nextCalled = false;
  const req = { headers: { authorization: `Bearer ${token}` }, originalUrl: url };
  try {
    await protect(req, {
      status(code) { statusCode = code; return this; },
      json(body) { payload = body; return this; },
    }, () => { nextCalled = true; });
  } finally {
    User.findById = originalFindById;
  }
  return { req, statusCode, payload, nextCalled };
});

const baseUser = (requiresPasswordChange) => ({
  _id: "650000000000000000000010",
  firstName: "Staff",
  middleName: "",
  lastName: "Member",
  email: "staff@example.test",
  role: "receptionist",
  status: "active",
  emailVerified: true,
  tokenVersion: 0,
  ...(requiresPasswordChange === undefined ? {} : { requiresPasswordChange }),
});

test("generated temporary password has the default 12-character length", () => {
  assert.equal(generateTemporaryPassword().length, 12);
});

test("generated temporary password satisfies every required character class", () => {
  const password = generateTemporaryPassword(16);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[!@#$%&*?]/);
});

test("generated temporary passwords are not reused", () => {
  assert.equal(new Set(Array.from({ length: 30 }, () => generateTemporaryPassword())).size, 30);
});

test("generator rejects lengths outside 10 to 16", () => {
  assert.throws(() => generateTemporaryPassword(9), RangeError);
  assert.throws(() => generateTemporaryPassword(17), RangeError);
});

test("legacy user without the flag receives a normal session", async () => {
  await withJwtSecret(() => {
    const session = createAuthSession(baseUser());
    assert.equal(session.mustChangePassword, false);
    assert.equal(session.user.mustChangePassword, false);
  });
});

test("existing user with false receives a normal session", async () => {
  await withJwtSecret(() => assert.equal(createAuthSession(baseUser(false)).mustChangePassword, false));
});

test("newly flagged user receives restricted setup state", async () => {
  await withJwtSecret(() => assert.equal(createAuthSession(baseUser(true)).mustChangePassword, true));
});

test("temporary-password flow wins safely if both onboarding flags coexist", async () => {
  await withJwtSecret(async () => {
    const originalFindOne = User.findOne;
    const password = await bcrypt.hash("Temporary1!", 4);
    User.findOne = () => ({
      select: async () => ({
        ...baseUser(true),
        passwordSetupRequired: true,
        password,
      }),
    });
    let statusCode;
    let body;
    try {
      await loginUser(
        { body: { email: "staff@example.test", password: "Temporary1!" } },
        {
          status(code) { statusCode = code; return this; },
          json(payload) { body = payload; return this; },
        },
        (error) => { throw error; }
      );
    } finally {
      User.findOne = originalFindOne;
    }
    assert.equal(statusCode, 200);
    assert.equal(body.mustChangePassword, true);
  });
});

test("legacy invitation-only account still receives the original setup-link response", async () => {
  const originalFindOne = User.findOne;
  const password = await bcrypt.hash("LegacyPass1!", 4);
  User.findOne = () => ({
    select: async () => ({
      ...baseUser(),
      passwordSetupRequired: true,
      password,
    }),
  });
  let statusCode;
  let body;
  try {
    await loginUser(
      { body: { email: "staff@example.test", password: "LegacyPass1!" } },
      {
        status(code) { statusCode = code; return this; },
        json(payload) { body = payload; return this; },
      },
      (error) => { throw error; }
    );
  } finally {
    User.findOne = originalFindOne;
  }
  assert.equal(statusCode, 403);
  assert.match(body.message, /invitation sent to your email/);
});

test("new Admin-created receptionist and Admin use only temporary-password onboarding", async () => {
  const originals = {
    startSession: mongoose.startSession,
    create: User.create,
    fetch: global.fetch,
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME,
  };
  const createdUsers = [];
  const emailBodies = [];
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.test";
  process.env.BREVO_SENDER_NAME = "Test Clinic";
  mongoose.startSession = async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} });
  User.create = async ([data]) => {
    const created = { ...data, _id: `65000000000000000000001${createdUsers.length + 1}` };
    createdUsers.push(created);
    return [created];
  };
  global.fetch = async (_url, options) => { emailBodies.push(JSON.parse(options.body)); return { ok: true }; };
  try {
    for (const role of ["receptionist", "admin"]) {
      const result = await createUser({
        firstName: "New", lastName: role, email: `${role}@example.test`,
        role, status: "active",
      });
      const created = createdUsers.at(-1);
      assert.equal(created.passwordSetupRequired, false);
      assert.equal(created.requiresPasswordChange, true);
      assert.match(created.password, /^\$2[aby]\$/);
      assert.equal(emailBodies.at(-1).to[0].email, `${role}@example.test`);
      assert.equal("temporaryPassword" in result, false);
      assert.equal("password" in result, false);
    }
  } finally {
    mongoose.startSession = originals.startSession;
    User.create = originals.create;
    global.fetch = originals.fetch;
    for (const [key, value] of [
      ["BREVO_API_KEY", originals.apiKey],
      ["BREVO_SENDER_EMAIL", originals.senderEmail],
      ["BREVO_SENDER_NAME", originals.senderName],
    ]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("staff provisioning does not commit when temporary-password email delivery fails", async () => {
  const originals = { startSession: mongoose.startSession, create: User.create, fetch: global.fetch };
  const previousEnv = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"].map((key) => [key, process.env[key]]);
  let committed = false;
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.test";
  process.env.BREVO_SENDER_NAME = "Test Clinic";
  mongoose.startSession = async () => ({
    async withTransaction(callback) { await callback(); committed = true; },
    endSession: async () => {},
  });
  User.create = async ([data]) => [{ ...data, _id: "650000000000000000000012" }];
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ code: "provider_error" }) });
  try {
    await assert.rejects(
      createUser({ firstName: "New", lastName: "Admin", email: "admin@example.test", role: "admin", status: "active" }),
      (error) => error.statusCode === 502
    );
    assert.equal(committed, false);
  } finally {
    mongoose.startSession = originals.startSession;
    User.create = originals.create;
    global.fetch = originals.fetch;
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("restricted user cannot access a normal business API", async () => {
  const result = await runProtect({ user: baseUser(true), url: "/api/dashboard" });
  assert.equal(result.statusCode, 403);
  assert.equal(result.payload.code, "PASSWORD_CHANGE_REQUIRED");
  assert.equal(result.nextCalled, false);
});

test("restricted user can access auth me", async () => {
  const result = await runProtect({ user: baseUser(true), url: "/api/auth/me" });
  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.email, "staff@example.test");
});

test("restricted user can access the password setup endpoint", async () => {
  const result = await runProtect({ user: baseUser(true), url: "/api/auth/complete-password-setup" });
  assert.equal(result.nextCalled, true);
});

test("legacy user remains allowed through protected business APIs", async () => {
  assert.equal((await runProtect({ user: baseUser(), url: "/api/dashboard" })).nextCalled, true);
});

test("explicit false remains allowed through protected business APIs", async () => {
  assert.equal((await runProtect({ user: baseUser(false), url: "/api/dashboard" })).nextCalled, true);
});

test("password setup accepts the canonical 8-character minimum", () => {
  assert.equal(runPasswordValidator({ newPassword: "12345678", confirmPassword: "12345678" }).nextCalled, true);
});

test("password setup accepts the canonical 16-character maximum", () => {
  assert.equal(runPasswordValidator({ newPassword: "1234567890123456", confirmPassword: "1234567890123456" }).nextCalled, true);
});

test("password setup rejects passwords shorter than 8 characters", () => {
  const result = runPasswordValidator({ newPassword: "1234567", confirmPassword: "1234567" });
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /8 to 16/);
});

test("password setup rejects passwords longer than 16 characters", () => {
  assert.equal(runPasswordValidator({ newPassword: "12345678901234567", confirmPassword: "12345678901234567" }).statusCode, 400);
});

test("password setup rejects a confirmation mismatch", () => {
  assert.match(runPasswordValidator({ newPassword: "Secure123", confirmPassword: "Secure124" }).payload.message, /do not match/);
});

test("successful setup replaces the temporary hash, clears the flag, and returns no password", async () => {
  await withJwtSecret(async () => {
    const originalFindOneAndUpdate = User.findOneAndUpdate;
    const originalAuditCreate = AuditLog.create;
    const oldHash = await bcrypt.hash("Temporary1!", 4);
    let update;
    User.findOneAndUpdate = (_filter, nextUpdate) => {
      update = nextUpdate;
      return {
        select: async () => ({
          ...baseUser(false),
          password: nextUpdate.$set.password,
          tokenVersion: 1,
        }),
      };
    };
    AuditLog.create = async (data) => data;
    let statusCode;
    let body;
    try {
      await completeTemporaryPasswordSetup(
        {
          user: baseUser(true),
          validatedAuth: { newPassword: "Permanent2!" },
          ip: "127.0.0.1",
          get: () => "test-agent",
        },
        {
          status(code) { statusCode = code; return this; },
          json(payload) { body = payload; return this; },
        },
        (error) => { throw error; }
      );
    } finally {
      User.findOneAndUpdate = originalFindOneAndUpdate;
      AuditLog.create = originalAuditCreate;
    }
    assert.equal(statusCode, 200);
    assert.equal(update.$set.passwordSetupRequired, false);
    assert.equal(update.$set.requiresPasswordChange, false);
    assert.equal(await bcrypt.compare("Temporary1!", update.$set.password), false);
    assert.equal(await bcrypt.compare("Permanent2!", update.$set.password), true);
    assert.equal(body.mustChangePassword, false);
    assert.equal("password" in body.user, false);
    assert.notEqual(update.$set.password, oldHash);
  });
});

test("user schema defaults the new flag to false and does not require it", () => {
  const schemaPath = User.schema.path("requiresPasswordChange");
  assert.notEqual(schemaPath.isRequired, true);
  assert.equal(schemaPath.defaultValue, false);
});

test("authenticated setup route is registered with protect before its controller", () => {
  const source = readFileSync(path.join(__dirname, "../routes/authRoutes.js"), "utf8");
  assert.match(source, /"\/complete-password-setup",\s*protect,\s*validateTemporaryPasswordChange,\s*completeTemporaryPasswordSetup/s);
});

test("patient registration validator remains mounted on the public register route", () => {
  const source = readFileSync(path.join(__dirname, "../routes/authRoutes.js"), "utf8");
  assert.match(source, /router\.post\("\/register", validateRegistration, registerUser\)/);
});

test("no startup migration or bulk update enables the flag", () => {
  const appSource = readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const serverSource = readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.doesNotMatch(`${appSource}\n${serverSource}`, /updateMany[\s\S]*requiresPasswordChange/);
});

test("temporary-password reissue paths explicitly disable legacy invitation setup", () => {
  const doctorSource = readFileSync(path.join(__dirname, "../services/doctorService.js"), "utf8");
  const userSource = readFileSync(path.join(__dirname, "../services/userService.js"), "utf8");
  assert.match(doctorSource, /user\.passwordSetupRequired = false;\s*user\.requiresPasswordChange = true;/);
  assert.match(userSource, /user\.passwordSetupRequired = false;\s*user\.requiresPasswordChange = true;/);
});

test("frontend login routes only temporary-password sessions to setup-password", () => {
  const loginSource = readFileSync(path.join(__dirname, "../../client/src/pages/Login.jsx"), "utf8");
  assert.match(loginSource, /mustChangePassword === true[\s\S]*'\/setup-password'/);
  assert.doesNotMatch(loginSource, /navigate\([^)]*setup-account/);
});
