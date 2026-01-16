// server/utils/mailgunService.js
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const logger = require("./logger");

const mailgun = new Mailgun(formData);

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

// Only initialize MG if keys are present (allow fallback for dev)
let mg;
if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
  mg = mailgun.client({
    username: "api",
    key: MAILGUN_API_KEY,
  });
}

/**
 * Sends a password reset email using Mailgun.
 * In development/test mode without API keys, it logs the link to console.
 */
async function sendPasswordResetEmail(toEmail, resetToken) {
  const resetLink = `https://msktf.com/reset-password.html?token=${resetToken}&email=${encodeURIComponent(
    toEmail
  )}`;

  // FALLBACK for Dev/Test environments without configured Mailgun
  if (!mg) {
    logger.info(`--- [DEV/TEST] Password Reset Link ---`);
    logger.info(`To: ${toEmail}`);
    logger.info(`Link: ${resetLink}`);
    logger.info(`--------------------------------------`);
    return;
  }

  const messageData = {
    from: "MSKTF Support <noreply@msktf.com>",
    to: toEmail,
    subject: "Reset Your MSKTF Password",
    text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${resetLink}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>You requested a password reset for your MSKTF account.</p>
        <p>Please click the button below to set a new password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
        <p style="margin-top: 24px; font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 14px; color: #666;">${resetLink}</p>
      </div>
    `,
  };

  try {
    await mg.messages.create(MAILGUN_DOMAIN, messageData);
  } catch (error) {
    logger.error("Mailgun Send Error:", error?.response?.body || error);
    throw new Error("Failed to send reset email");
  }
}

module.exports = { sendPasswordResetEmail };