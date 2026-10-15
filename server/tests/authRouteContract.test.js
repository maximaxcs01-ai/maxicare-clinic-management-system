const assert = require("node:assert/strict");
const { test } = require("node:test");
const authRoutes = require("../routes/authRoutes");

test("registration and OTP routes remain wired to their validators and controllers", () => {
  const registrationRoutes = new Map(
    authRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => [layer.route.path, layer.route])
  );

  for (const path of ["/register", "/verify-email", "/resend-otp"]) {
    const route = registrationRoutes.get(path);
    assert.ok(route, `Missing POST /api/auth${path}`);
    assert.equal(route.methods.post, true);
    assert.ok(route.stack.length >= 2);
    assert.ok(route.stack.every((layer) => typeof layer.handle === "function"));
  }
});
