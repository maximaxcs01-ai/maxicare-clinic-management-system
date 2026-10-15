const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const {
  sendVerificationEmail,
} = require("../services/emailService");

const originalEnvironment = {
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME,
};
const originalFetch = global.fetch;
const originalConsoleError = console.error;

let logs;

beforeEach(() => {
  process.env.BREVO_API_KEY = "api-key-for-test";
  process.env.BREVO_SENDER_EMAIL = "clinic@example.test";
  process.env.BREVO_SENDER_NAME = "Clinic Sender";
  logs = [];
  console.error = (message) => logs.push(message);
});

afterEach(() => {
  global.fetch = originalFetch;
  console.error = originalConsoleError;

  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

test("logs safe Brevo rejection details and keeps the public 502 generic", async () => {
  global.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({
      code: "invalid_api_key",
      message:
        "Rejected for person@example.test using api-key-for-test and code 654321",
    }),
  });

  await assert.rejects(
    sendVerificationEmail({
      email: "person@example.test",
      firstName: "Private Name",
      otp: "654321",
    }),
    (error) =>
      error.statusCode === 502 &&
      error.message === "Unable to send verification email. Please try again."
  );

  assert.equal(logs.length, 1);
  const logged = JSON.parse(logs[0]);
  assert.deepEqual(logged, {
    event: "email_delivery_failed",
    provider: "brevo",
    status: 401,
    providerErrorCode: "invalid_api_key",
    message:
      "Rejected for [redacted-email] using [redacted] and code [redacted-code]",
    senderDomain: "example.test",
  });
  assert.doesNotMatch(logs[0], /api-key-for-test|person@example\.test|654321|Private Name/);
});

test("logs timeout classification without exposing the fetch error", async () => {
  const timeout = new Error("request timed out with secret details");
  timeout.name = "TimeoutError";
  global.fetch = async () => {
    throw timeout;
  };

  await assert.rejects(
    sendVerificationEmail({
      email: "person@example.test",
      firstName: "Patient",
      otp: "123456",
    }),
    (error) => error.statusCode === 502
  );

  assert.deepEqual(JSON.parse(logs[0]), {
    event: "email_delivery_failed",
    provider: "brevo",
    status: null,
    providerErrorCode: null,
    message: "Email provider request timed out",
    senderDomain: "example.test",
  });
  assert.doesNotMatch(logs[0], /secret details|person@example\.test|123456/);
});

test("rejects invalid sender configuration before making a provider request", async () => {
  process.env.BREVO_SENDER_EMAIL = "not-an-email";
  let requestMade = false;
  global.fetch = async () => {
    requestMade = true;
  };

  await assert.rejects(
    sendVerificationEmail({
      email: "person@example.test",
      firstName: "Patient",
      otp: "123456",
    }),
    (error) => error.statusCode === 503
  );

  assert.equal(requestMade, false);
  assert.deepEqual(JSON.parse(logs[0]), {
    event: "email_delivery_configuration_error",
    provider: "brevo",
    reason: "invalid_sender_configuration",
    senderDomain: null,
  });
});
