const AppError = require("../utils/AppError");

const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

const getEmailConfiguration = () => {
  const requiredVariables = [
    "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL",
    "BREVO_SENDER_NAME",
  ];
  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]?.trim()
  );

  if (missingVariables.length > 0) {
    console.error(
      JSON.stringify({
        event: "email_delivery_configuration_error",
        provider: "brevo",
        missingVariables,
      })
    );
    throw new AppError("Email delivery is not configured", 503);
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL.trim();
  const senderName = process.env.BREVO_SENDER_NAME.trim();
  if (!EMAIL_ADDRESS_PATTERN.test(senderEmail) || !senderName) {
    console.error(
      JSON.stringify({
        event: "email_delivery_configuration_error",
        provider: "brevo",
        reason: "invalid_sender_configuration",
        senderDomain: getEmailDomain(senderEmail),
      })
    );
    throw new AppError("Email delivery is not configured", 503);
  }

  return {
    apiKey: process.env.BREVO_API_KEY.trim(),
    senderEmail,
    senderName,
  };
};

const getEmailDomain = (email) => {
  const atIndex = email.lastIndexOf("@");
  return atIndex === -1 ? null : email.slice(atIndex + 1).toLowerCase();
};

const redactSensitiveText = (value, sensitiveValues) => {
  let safeValue = String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b\d{6}\b/g, "[redacted-code]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue) {
      safeValue = safeValue.split(sensitiveValue).join("[redacted]");
    }
  }

  return safeValue.replace(/[\r\n\t]/g, " ").slice(0, 240);
};

const getProviderError = async (response) => {
  try {
    const body = await response.json();
    return {
      code:
        typeof body?.code === "string" &&
        /^[A-Za-z0-9_.-]{1,80}$/.test(body.code)
          ? body.code
          : null,
      message: typeof body?.message === "string" ? body.message : null,
    };
  } catch {
    return { code: null, message: null };
  }
};

const logEmailDeliveryFailure = (details) => {
  console.error(JSON.stringify({ event: "email_delivery_failed", ...details }));
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const sendEmail = async ({ email, name, subject, htmlContent, errorMessage }) => {
  const { apiKey, senderEmail, senderName } = getEmailConfiguration();

  let response;

  try {
    response = await fetch(BREVO_EMAIL_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email, name }],
        subject,
        htmlContent,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    const errorCode =
      typeof error?.code === "string" && NETWORK_ERROR_CODES.has(error.code)
        ? error.code
        : null;
    logEmailDeliveryFailure({
      provider: "brevo",
      status: null,
      providerErrorCode: errorCode,
      message:
        error?.name === "TimeoutError"
          ? "Email provider request timed out"
          : "Email provider network request failed",
      senderDomain: getEmailDomain(senderEmail),
    });
    throw new AppError(errorMessage, 502);
  }

  if (!response.ok) {
    const providerError = await getProviderError(response);
    logEmailDeliveryFailure({
      provider: "brevo",
      status: response.status,
      providerErrorCode: providerError.code
        ? redactSensitiveText(providerError.code, [
            apiKey,
            senderEmail,
            senderName,
            email,
            name,
          ])
        : null,
      message: providerError.message
        ? redactSensitiveText(providerError.message, [
            apiKey,
            senderEmail,
            senderName,
            email,
            name,
          ])
        : "Email provider rejected the request",
      senderDomain: getEmailDomain(senderEmail),
    });
    throw new AppError(errorMessage, 502);
  }
};

const sendVerificationEmail = async ({ email, firstName, otp }) => {
  const safeName = escapeHtml(firstName);
  const safeOtp = escapeHtml(otp);

  await sendEmail({
    email,
    name: firstName,
    subject: "Verify your Maxicare Clinic email",
    htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#102a43"><h2>Maxicare Clinic</h2><p>Hello ${safeName},</p><p>Verify your email using this code:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${safeOtp}</p><p>This code expires in 5 minutes.</p><p>If you did not request this registration, you may ignore this email.</p></body></html>`,
    errorMessage: "Unable to send verification email. Please try again.",
  });
};

const sendPasswordResetEmail = async ({ email, firstName, otp }) => {
  const safeName = escapeHtml(firstName);
  const safeOtp = escapeHtml(otp);

  await sendEmail({
    email,
    name: firstName,
    subject: "Maxicare Clinic Password Reset Code",
    htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#102a43"><h2>Maxicare Clinic</h2><p>Hello ${safeName},</p><p>Your password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${safeOtp}</p><p>This code expires in 5 minutes.</p><p>If you did not request this password reset, you may ignore this email.</p></body></html>`,
    errorMessage: "Unable to send password reset email. Please try again.",
  });
};

const sendDoctorInvitationEmail = async ({ email, firstName, lastName, setupUrl }) => {
  const safeName = escapeHtml(`${firstName} ${lastName}`.trim() || firstName || "Doctor");
  const safeSetupUrl = escapeHtml(setupUrl);

  await sendEmail({
    email,
    name: `${firstName} ${lastName}`.trim() || firstName || "Doctor",
    subject: "Set up your Maxicare Clinic account",
    htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#102a43;line-height:1.6"><h2>Maxicare Clinic</h2><p>Hello ${safeName},</p><p>An account has been created for you in the Maxicare Clinic Management System.</p><p>Please set your password to activate your account.</p><p><a href="${safeSetupUrl}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:white;text-decoration:none;border-radius:6px;font-weight:700">Set Up My Account</a></p><p>This link will expire in 24 hours.</p><p>If you were not expecting this invitation, please contact the clinic administrator.</p></body></html>`,
    errorMessage: "Unable to send doctor invitation email. Please try again.",
  });
};

const sendPatientInvitationEmail = async ({ email, firstName, lastName, setupUrl }) => {
  const safeName = escapeHtml(`${firstName} ${lastName}`.trim() || firstName || "Patient");
  const safeSetupUrl = escapeHtml(setupUrl);

  await sendEmail({
    email,
    name: `${firstName} ${lastName}`.trim() || firstName || "Patient",
    subject: "Activate your Maxicare Clinic patient portal",
    htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#102a43;line-height:1.6"><h2>Maxicare Clinic</h2><p>Hello ${safeName},</p><p>Your existing clinic patient record has been linked to the patient portal.</p><p>Set a password to activate portal access.</p><p><a href="${safeSetupUrl}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:white;text-decoration:none;border-radius:6px;font-weight:700">Activate My Portal</a></p><p>This link will expire in 24 hours. If you were not expecting this invitation, please contact the clinic.</p></body></html>`,
    errorMessage: "Unable to send patient activation email. Please try again.",
  });
};

const sendTemporaryPasswordEmail = async ({
  email,
  firstName,
  lastName,
  role,
  temporaryPassword,
}) => {
  const displayName = `${firstName} ${lastName}`.trim() || firstName || "Staff member";
  const safeName = escapeHtml(displayName);
  const safeRole = escapeHtml(role);
  const safePassword = escapeHtml(temporaryPassword);
  const loginUrl = `${(process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "")}/login`;
  const safeLoginUrl = escapeHtml(loginUrl);

  await sendEmail({
    email,
    name: displayName,
    subject: "Your temporary Maxicare Clinic password",
    htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#102a43;line-height:1.6"><h2>Maxicare Clinic</h2><p>Hello ${safeName},</p><p>Your ${safeRole} account has been created.</p><p>Email: <strong>${escapeHtml(email)}</strong></p><p>Temporary password:</p><p style="font-size:20px;font-weight:700;letter-spacing:1px">${safePassword}</p><p>Sign in with this password. You will be required to create a new password before accessing the clinic system.</p><p><a href="${safeLoginUrl}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:white;text-decoration:none;border-radius:6px;font-weight:700">Sign In</a></p><p>If you were not expecting this account, please contact the clinic administrator.</p></body></html>`,
    errorMessage: "Unable to send temporary password email. The account was not created.",
  });
};

module.exports = {
  getEmailConfiguration,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendDoctorInvitationEmail,
  sendPatientInvitationEmail,
  sendTemporaryPasswordEmail,
};
