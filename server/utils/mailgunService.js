// server/utils/mailgunService.js
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const winston = require("winston"); // For logging

// --- Configuration ---
const API_KEY = process.env.MAILGUN_API_KEY;
const DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || `no-reply@${DOMAIN}`; // Fallback 'from'
const FRONTEND_URL = process.env.FRONTEND_URL || "https://localhost:5173"; // Base URL for links

if (!API_KEY || !DOMAIN) {
  winston.error(
    "Mailgun API Key or Domain not configured in environment variables. Email sending disabled."
  );
  // Optionally throw an error if email is critical
  // throw new Error('Mailgun configuration missing.');
}

const mailgun = new Mailgun(formData);
const mg =
  API_KEY && DOMAIN ? mailgun.client({ username: "api", key: API_KEY }) : null;

/**
 * Sends a password reset email.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} resetToken - The PLAINTEXT password reset token.
 * @returns {Promise<object|null>} Mailgun API response or null if disabled/error.
 */
async function sendPasswordResetEmail(toEmail, resetToken) {
  if (!mg) {
    winston.warn(
      `Mailgun service is not configured. Skipping password reset email to ${toEmail}.`
    );
    // In development, log the token and link to console for testing without email
    console.log(`--- DEV MODE: Password Reset ---`);
    console.log(`To: ${toEmail}`);
    console.log(`Token: ${resetToken}`);
    console.log(
      `Reset Link: ${FRONTEND_URL}/reset-password.html?token=${resetToken}`
    );
    console.log(`-----------------------------`);
    return null; // Indicate email wasn't sent
  }

  const resetLink = `${FRONTEND_URL}/reset-password.html?token=${resetToken}`;

  const messageData = {
    from: FROM_EMAIL,
    to: [toEmail], // Mailgun expects an array of recipients
    subject: "MSKTF Password Reset Request",
    text: `You requested a password reset for your MSKTF account.\n\nPlease click the following link to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
    // Optional: HTML version
    html: `<p>You requested a password reset for your MSKTF account.</p>
               <p>Please click the following link to reset your password:</p>
               <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
               <p>This link will expire in <strong>1 hour</strong>.</p>
               <p>If you did not request this, please ignore this email.</p>`,
  };

  try {
    winston.info(
      `Attempting to send password reset email to ${toEmail} via Mailgun...`
    );
    const result = await mg.messages.create(DOMAIN, messageData);
    winston.info(
      `Password reset email sent successfully to ${toEmail}. Message ID: ${result.id}`
    );
    return result;
  } catch (error) {
    winston.error(
      `Failed to send password reset email to ${toEmail}:`,
      error?.response?.body || error
    );
    console.error("Mailgun Send Error:", error?.response?.body || error); // Also log detailed error
    // Decide whether to throw or just return null/error indicator
    // throw new Error('Failed to send password reset email.'); // Or handle more gracefully
    return null;
  }
}

module.exports = {
  sendPasswordResetEmail,
};
