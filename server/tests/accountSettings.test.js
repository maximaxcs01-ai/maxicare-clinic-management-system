const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { afterEach, test } = require("node:test");
const User = require("../models/User");
const Notification = require("../models/Notification");
const accountSettingsService = require("../services/accountSettingsService");
const notificationService = require("../services/notificationService");
const { createAuthSession } = require("../services/authSessionService");
const authController = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateAuthenticatedPasswordChange,
  validateNotificationPreference,
} = require("../validators/authValidator");

const originalMethods = {
  findById: User.findById,
  findByIdAndUpdate: User.findByIdAndUpdate,
  findOneAndUpdate: User.findOneAndUpdate,
  notificationFindOneAndUpdate: Notification.findOneAndUpdate,
};
const originalJwtSecret = process.env.JWT_SECRET;
const originalAccountSettingsMethods = {
  changePassword: accountSettingsService.changePassword,
  updateNotificationPreference:
    accountSettingsService.updateNotificationPreference,
};

afterEach(() => {
  User.findById = originalMethods.findById;
  User.findByIdAndUpdate = originalMethods.findByIdAndUpdate;
  User.findOneAndUpdate = originalMethods.findOneAndUpdate;
  Notification.findOneAndUpdate = originalMethods.notificationFindOneAndUpdate;
  accountSettingsService.changePassword =
    originalAccountSettingsMethods.changePassword;
  accountSettingsService.updateNotificationPreference =
    originalAccountSettingsMethods.updateNotificationPreference;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

const runValidator = (validator, body) => {
  const req = { body };
  let statusCode;
  let response;
  let nextCalled = false;
  validator(
    req,
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        response = payload;
      },
    },
    () => {
      nextCalled = true;
    }
  );
  return { req, statusCode, response, nextCalled };
};

test("password change validator applies the existing 8 to 16 character policy", () => {
  assert.equal(
    runValidator(validateAuthenticatedPasswordChange, {
      currentPassword: "current",
      newPassword: "1234567",
      confirmPassword: "1234567",
    }).statusCode,
    400
  );

  const valid = runValidator(validateAuthenticatedPasswordChange, {
    currentPassword: "current",
    newPassword: "abcdefgh",
    confirmPassword: "abcdefgh",
  });
  assert.equal(valid.nextCalled, true);
  assert.deepEqual(valid.req.validatedAuth, {
    currentPassword: "current",
    newPassword: "abcdefgh",
  });
  assert.equal("confirmPassword" in valid.req.validatedAuth, false);
});

test("password change validator rejects confirmation mismatch", () => {
  const result = runValidator(validateAuthenticatedPasswordChange, {
    currentPassword: "current",
    newPassword: "abcdefgh",
    confirmPassword: "abcdefgi",
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.nextCalled, false);
});

test("notification preference validator accepts only a boolean", () => {
  assert.equal(
    runValidator(validateNotificationPreference, { inApp: false }).nextCalled,
    true
  );
  assert.equal(
    runValidator(validateNotificationPreference, { inApp: "false" }).statusCode,
    400
  );
});

test("account settings expose only approved account and consent fields", async () => {
  const user = {
    _id: "private-id",
    email: "patient@example.test",
    role: "patient",
    status: "active",
    tokenVersion: 9,
    password: "private-hash",
    termsVersion: "2026-10-16",
    termsAcceptedAt: new Date("2026-10-16T00:00:00.000Z"),
    notificationPreferences: {},
  };
  User.findById = () => ({
    select: async () => user,
  });

  const settings = await accountSettingsService.getAccountSettings("own-user");
  assert.equal(settings.email, user.email);
  assert.equal(settings.role, "patient");
  assert.equal(settings.status, "active");
  assert.equal(settings.notificationPreferences.inApp, true);
  assert.equal(settings.termsVersion, user.termsVersion);
  assert.equal("id" in settings, false);
  assert.equal("_id" in settings, false);
  assert.equal("password" in settings, false);
  assert.equal("tokenVersion" in settings, false);
});

test("notification preference update is scoped to the authenticated user", async () => {
  let updatedId;
  let update;
  User.findByIdAndUpdate = (userId, updateData) => {
    updatedId = userId;
    update = updateData;
    return {
      select: async () => ({ notificationPreferences: { inApp: false } }),
    };
  };

  const result = await accountSettingsService.updateNotificationPreference(
    "authenticated-user",
    false
  );
  assert.equal(updatedId, "authenticated-user");
  assert.deepEqual(update, {
    $set: { "notificationPreferences.inApp": false },
  });
  assert.deepEqual(result, { inApp: false });
});

test("notification preference controller ignores caller-supplied account identifiers", async () => {
  let call;
  accountSettingsService.updateNotificationPreference = async (userId, inApp) => {
    call = { userId, inApp };
    return { inApp };
  };
  let response;

  await authController.updateNotificationPreference(
    {
      user: { _id: "authenticated-user" },
      validatedNotificationPreference: { inApp: false },
      body: { userId: "another-user", inApp: false },
    },
    {
      status() {
        return this;
      },
      json(payload) {
        response = payload;
      },
    },
    (error) => {
      throw error;
    }
  );

  assert.deepEqual(call, { userId: "authenticated-user", inApp: false });
  assert.deepEqual(response.data, { inApp: false });
});

test("incorrect current password is rejected without updating the User", async () => {
  const user = {
    _id: "user-1",
    password: await bcrypt.hash("correct-password", 4),
    tokenVersion: 3,
  };
  let updateCalled = false;
  User.findById = () => ({ select: async () => user });
  User.findOneAndUpdate = () => {
    updateCalled = true;
    throw new Error("must not update");
  };

  await assert.rejects(
    accountSettingsService.changePassword("user-1", {
      currentPassword: "wrong-password",
      newPassword: "newpass123",
    }),
    (error) => error.statusCode === 400 && /Current password is incorrect/.test(error.message)
  );
  assert.equal(updateCalled, false);
});

test("password change hashes the new password and increments tokenVersion", async () => {
  const oldPassword = "oldpass123";
  const oldHash = await bcrypt.hash(oldPassword, 4);
  const user = {
    _id: "user-2",
    role: "doctor",
    firstName: "Taylor",
    lastName: "Doctor",
    email: "doctor@example.test",
    password: oldHash,
    tokenVersion: 4,
  };
  let updateFilter;
  let updatePayload;
  User.findById = () => ({ select: async () => user });
  User.findOneAndUpdate = (filter, update) => {
    updateFilter = filter;
    updatePayload = update;
    return {
      select: async () => ({
        ...user,
        password: update.$set.password,
        tokenVersion: user.tokenVersion + update.$inc.tokenVersion,
      }),
    };
  };

  const updated = await accountSettingsService.changePassword("user-2", {
    currentPassword: oldPassword,
    newPassword: "abcdefgh",
  });
  assert.equal(updateFilter._id, "user-2");
  assert.equal(updateFilter.password, oldHash);
  assert.equal(updatePayload.$inc.tokenVersion, 1);
  assert.notEqual(updated.password, "abcdefgh");
  assert.equal(await bcrypt.compare("abcdefgh", updated.password), true);
  assert.equal(await bcrypt.compare(oldPassword, updated.password), false);
  assert.equal(updated.tokenVersion, 5);

  process.env.JWT_SECRET = "account-settings-test-secret";
  const session = createAuthSession(updated);
  const claims = jwt.verify(session.token, process.env.JWT_SECRET);
  assert.equal(claims.tokenVersion, 5);
  assert.equal("password" in session.user, false);
});

test("password change endpoint returns a refreshed current-session JWT", async () => {
  process.env.JWT_SECRET = "account-settings-controller-secret";
  const originalChangePassword = accountSettingsService.changePassword;
  const changedUser = {
    _id: "user-5",
    role: "patient",
    firstName: "Casey",
    lastName: "Patient",
    email: "casey@example.test",
    tokenVersion: 12,
  };
  accountSettingsService.changePassword = async (userId, input) => {
    assert.equal(userId, "user-5");
    assert.deepEqual(input, {
      currentPassword: "oldpass123",
      newPassword: "newpass123",
    });
    return changedUser;
  };
  let response;
  try {
    await authController.changeAuthenticatedPassword(
      {
        user: { _id: "user-5" },
        validatedAuth: {
          currentPassword: "oldpass123",
          newPassword: "newpass123",
        },
      },
      {
        status() {
          return this;
        },
        json(payload) {
          response = payload;
        },
      },
      (error) => {
        throw error;
      }
    );
  } finally {
    accountSettingsService.changePassword = originalChangePassword;
  }

  assert.equal(response.message, "Password changed successfully.");
  assert.equal(
    jwt.verify(response.token, process.env.JWT_SECRET).tokenVersion,
    12
  );
  assert.equal("password" in response, false);
});

test("password reuse is rejected", async () => {
  const passwordHash = await bcrypt.hash("samepass123", 4);
  User.findById = () => ({
    select: async () => ({ _id: "user-3", password: passwordHash }),
  });
  User.findOneAndUpdate = () => {
    throw new Error("must not update");
  };

  await assert.rejects(
    accountSettingsService.changePassword("user-3", {
      currentPassword: "samepass123",
      newPassword: "samepass123",
    }),
    (error) => error.statusCode === 400 && /different/.test(error.message)
  );
});

test("signing out all devices increments tokenVersion", async () => {
  let update;
  User.findByIdAndUpdate = (_userId, updateData) => {
    update = updateData;
    return { select: async () => ({ tokenVersion: 8 }) };
  };

  await accountSettingsService.signOutAllDevices("own-user");
  assert.deepEqual(update, { $inc: { tokenVersion: 1 } });
});

test("a JWT from before logout-all is rejected", async () => {
  process.env.JWT_SECRET = "account-settings-test-secret";
  const oldToken = jwt.sign(
    { id: "user-4", role: "patient", tokenVersion: 2 },
    process.env.JWT_SECRET
  );
  User.findById = () => ({
    select: async () => ({
      _id: "user-4",
      role: "patient",
      status: "active",
      emailVerified: true,
      tokenVersion: 3,
      requiresPasswordChange: false,
    }),
  });

  let statusCode;
  let payload;
  let nextCalled = false;
  await protect(
    {
      headers: { authorization: `Bearer ${oldToken}` },
      originalUrl: "/api/auth/account-settings",
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        payload = value;
      },
    },
    () => {
      nextCalled = true;
    }
  );
  assert.equal(statusCode, 401);
  assert.equal(payload.message, "Not authorized, token failed");
  assert.equal(nextCalled, false);
});

test("temporary-password users still cannot use account settings or session-management endpoints", async () => {
  process.env.JWT_SECRET = "account-settings-test-secret";
  const user = {
    _id: "restricted-user",
    role: "receptionist",
    status: "active",
    emailVerified: true,
    tokenVersion: 0,
    requiresPasswordChange: true,
  };
  User.findById = () => ({ select: async () => user });

  for (const originalUrl of [
    "/api/auth/account-settings",
    "/api/auth/change-password",
    "/api/auth/logout-all",
  ]) {
    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: 0 },
      process.env.JWT_SECRET
    );
    let statusCode;
    let payload;
    await protect(
      {
        headers: { authorization: `Bearer ${token}` },
        originalUrl,
      },
      {
        status(code) {
          statusCode = code;
          return this;
        },
        json(value) {
          payload = value;
        },
      },
      () => {
        throw new Error("Restricted route unexpectedly passed authentication");
      }
    );
    assert.equal(statusCode, 403);
    assert.equal(payload.code, "PASSWORD_CHANGE_REQUIRED");
  }
});

test("new in-app notification delivery respects opted-out preferences", async () => {
  let creates = 0;
  User.findById = () => ({
    select: async () => ({ notificationPreferences: { inApp: false } }),
  });
  Notification.findOneAndUpdate = async () => {
    creates += 1;
  };

  const result = await notificationService.createForUser({
    recipientUser: "opted-out-user",
    type: "appointment_confirmed",
    title: "Appointment Confirmed",
    message: "Your appointment was confirmed.",
    targetType: "patient_appointments",
    dedupeKey: "appointment:1:confirmed",
  });
  assert.equal(result, null);
  assert.equal(creates, 0);
});
