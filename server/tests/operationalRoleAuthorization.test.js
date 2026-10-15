const assert = require("node:assert/strict");
const { test } = require("node:test");
const appointmentRoutes = require("../routes/appointmentRoutes");
const consultationRoutes = require("../routes/consultationRoutes");
const patientRoutes = require("../routes/patientRoutes");
const prescriptionRoutes = require("../routes/prescriptionRoutes");
const queueRoutes = require("../routes/queueRoutes");
const walkInRoutes = require("../routes/walkInRoutes");

const invoke = (middleware, role) => {
  let passed = false;
  let statusCode = 200;
  let body;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };

  middleware({ user: { role }, headers: {} }, response, () => {
    passed = true;
  });
  return { passed, statusCode, body };
};

const getRouteGuard = (router, path, method) => {
  const layer = router.stack.find(
    (item) =>
      item.route?.path === path &&
      item.route.methods[method.toLowerCase()],
  );
  assert.ok(layer, `Expected ${method} ${path} route`);
  return layer.route.stack[0].handle;
};

const getGlobalRoleGuard = (router, allowedRole, deniedRole) => {
  const guard = router.stack
    .filter((layer) => !layer.route)
    .map((layer) => layer.handle)
    .find(
      (middleware) =>
        invoke(middleware, allowedRole).passed &&
        !invoke(middleware, deniedRole).passed,
    );
  assert.ok(guard, `Expected ${allowedRole}-only router guard`);
  return guard;
};

const assertAllowedForOperations = (guard, allowedRoles, deniedRoles) => {
  for (const role of allowedRoles) {
    assert.equal(invoke(guard, role).passed, true, `${role} should be allowed`);
  }
  for (const role of deniedRoles) {
    const result = invoke(guard, role);
    assert.equal(result.passed, false, `${role} should be denied`);
    assert.equal(result.statusCode, 403);
  }
};

test("Admin and Receptionist can perform non-clinical queue operations", () => {
  for (const [path, method] of [
    ["/", "get"],
    ["/doctors/:doctorId/call-next", "post"],
    ["/:id/return", "patch"],
    ["/:id/remove", "patch"],
  ]) {
    assertAllowedForOperations(
      getRouteGuard(queueRoutes, path, method),
      ["admin", "receptionist"],
      ["doctor", "patient"],
    );
  }
});

test("Admin and Receptionist can use walk-in and patient registration endpoints", () => {
  const walkInGuard = getGlobalRoleGuard(walkInRoutes, "admin", "doctor");
  assertAllowedForOperations(
    walkInGuard,
    ["admin", "receptionist"],
    ["doctor", "patient"],
  );

  for (const [path, method] of [
    ["/walk-in-search", "get"],
    ["/", "post"],
  ]) {
    assertAllowedForOperations(
      getRouteGuard(patientRoutes, path, method),
      ["admin", "receptionist"],
      ["doctor", "patient"],
    );
  }
});

test("Admin and Receptionist can use staff appointment operations", () => {
  for (const [path, method] of [
    ["/", "get"],
    ["/:id", "get"],
    ["/:id/confirm", "patch"],
    ["/:id/reject", "patch"],
    ["/:id/check-in", "patch"],
    ["/:id/queue", "post"],
    ["/:id/triage", "patch"],
    ["/:id/reschedule", "patch"],
  ]) {
    assertAllowedForOperations(
      getRouteGuard(appointmentRoutes, path, method),
      ["admin", "receptionist"],
      ["doctor"],
    );
  }
});

test("Consultation and prescription routes remain Doctor-only", () => {
  for (const router of [consultationRoutes, prescriptionRoutes]) {
    const doctorGuard = getGlobalRoleGuard(router, "doctor", "admin");
    assert.equal(invoke(doctorGuard, "doctor").passed, true);
    for (const role of ["admin", "receptionist", "patient"]) {
      assert.equal(invoke(doctorGuard, role).passed, false);
    }
  }
});

test("consultation cancellation is operational while deletion is admin-only", () => {
  assertAllowedForOperations(
    getRouteGuard(consultationRoutes, "/:id/cancel", "patch"),
    ["admin", "receptionist"],
    ["doctor", "patient"],
  );
  assertAllowedForOperations(
    getRouteGuard(consultationRoutes, "/:id", "delete"),
    ["admin"],
    ["receptionist", "doctor", "patient"],
  );
});

test("Only Admin and Receptionist can record triage vitals", () => {
  assertAllowedForOperations(
    getRouteGuard(appointmentRoutes, "/:id/triage", "patch"),
    ["admin", "receptionist"],
    ["doctor", "patient"],
  );
});
