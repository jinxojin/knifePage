// server/controllers/authController.js
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const { User, sequelize } = require("../models");
const { Op } = require("sequelize");
const { sendPasswordResetEmail } = require("../utils/mailgunService");
const ErrorHandler = require("../utils/errorHandler");
const logger = require("../utils/logger");

exports.forgotPassword = async (req, res, next) => {
  const timestamp = new Date().toISOString();
  logger.info(`[${timestamp}] Entering POST /api/auth/forgot-password handler...`);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[${timestamp}] /forgot-password - Validation Errors:`, errors.array());
    return next(new ErrorHandler("Validation error", 400, errors.array()));
  }

  try {
    const { email } = req.body;
    logger.info(`[${timestamp}] Searching for user with email: ${email}...`);
    const user = await User.findOne({ where: { email } });

    if (!user) {
      logger.info(`[${timestamp}] User with email ${email} not found. Sending standard success response.`);
      return res.json({
        message: "If an account with that email exists, we have sent a reset link.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const resetPasswordExpires = Date.now() + 3600000;

    await user.update({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: resetPasswordExpires,
    });

    logger.info(`[${timestamp}] Reset token saved for user ${user.id}.`);

    try {
      await sendPasswordResetEmail(user.email, resetToken);
      logger.info(`[${timestamp}] Reset email sent successfully.`);
    } catch (emailError) {
      logger.error(`[${timestamp}] Failed to send reset email to ${email}:`, emailError);
    }

    res.json({
      message: "If an account with that email exists, we have sent a reset link.",
    });
  } catch (error) {
    logger.error(`[${timestamp}] Error in /forgot-password:`, error);
    next(new ErrorHandler("Internal server error during password reset", 500));
  }
};

exports.resetPassword = async (req, res, next) => {
  const timestamp = new Date().toISOString();
  logger.info(`[${timestamp}] Entering POST /api/auth/reset-password handler...`);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[${timestamp}] /reset-password - Validation Errors:`, errors.array());
    return next(new ErrorHandler("Validation error", 400, errors.array()));
  }

  try {
    const { email, token, newPassword } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      logger.warn(`[${timestamp}] Reset attempt failed: Invalid user or no token set for ${email}.`);
      return next(new ErrorHandler("Password reset token is invalid or has expired.", 400));
    }

    if (Date.now() > user.resetPasswordExpires) {
      logger.warn(`[${timestamp}] Token for user ${user.id} has expired.`);
      return next(new ErrorHandler("Password reset token is invalid or has expired.", 400));
    }

    const isMatch = await bcrypt.compare(token, user.resetPasswordToken);
    if (!isMatch) {
      logger.warn(`[${timestamp}] Token hash mismatch for user ${user.id}.`);
      return next(new ErrorHandler("Password reset token is invalid or has expired.", 400));
    }

    logger.info(`[${timestamp}] Token verified for user ${user.id}. Updating password...`);
    await user.update({
      password: newPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      needsPasswordChange: false,
    });

    logger.info(`[${timestamp}] Password successfully reset for user ${user.id}.`);
    res.json({ message: "Password has been successfully reset." });
  } catch (error) {
    logger.error(`[${timestamp}] Error in /reset-password:`, error);
    next(new ErrorHandler("Internal server error during password reset", 500));
  }
};
