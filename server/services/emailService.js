const AppError = require("../utils/AppError");

const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

const getEmailConfiguration = () => {
  const requiredVariables = [
    "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL",
    "BREVO_SENDER_NAME",
  ];
  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
  );

  if (missingVariables.length > 0) {
    throw new AppError("Email delivery is not configured", 503);
  }

  return {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME,
  };
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
    throw new AppError(errorMessage, 502);
  }

  if (!response.ok) {
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

module.exports = {
  getEmailConfiguration,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
