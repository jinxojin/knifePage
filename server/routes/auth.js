// server/routes/auth.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { User } = require("../models"); // Only User model is needed here
const ErrorHandler = require("../utils/errorHandler");
const { sendPasswordResetEmail } = require("../utils/mailgunService");
const rateLimit = require("express-rate-limit"); // Import rate-limit

// Rate Limiters Definitions
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit to 5 requests per window
  message: {
    message:
      "Too many password reset requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Limit to 10 requests per window
  message: {
    message: "Too many password reset attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function to conditionally apply limiters
const applyLimiterIfNeeded = (limiter) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `Applying rate limiter: ${limiter.constructor.name || "limiter"}`
    );
    return limiter; // Apply the limiter if not testing
  } else {
    console.log(`Skipping rate limiter in test environment.`);
    return (req, res, next) => next(); // Dummy middleware if testing
  }
};

// Validation Middleware
const validateForgotPassword = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required.")
    .normalizeEmail(),
];
const validateResetPassword = [
  body("token").notEmpty().withMessage("Reset token is required."),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters."),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword)
      throw new Error("Passwords do not match");
    return true;
  }),
];

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  applyLimiterIfNeeded(forgotPasswordLimiter),
  validateForgotPassword,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        console.warn(
          `[${timestamp}] Forgot password attempt for non-existent email: ${email}`
        );
        return res.json({
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      }

      console.log(
        `[${timestamp}] User found (ID: ${user.id}) for email: ${email}`
      );
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = await bcrypt.hash(resetToken, 10);
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      console.log(
        `[${timestamp}] Attempting User.update() for reset token - User ID: ${user.id}`
      );
      try {
        const [affectedRows] = await User.update(
          { passwordResetToken: hashedToken, passwordResetExpires: expires },
          { where: { id: user.id } }
        );
        console.log(
          `[${timestamp}] User.update() affected rows: ${affectedRows}`
        );
        if (affectedRows !== 1)
          throw new Error("Failed to update user record (0 rows affected).");

        const reloadedUser = await User.findByPk(user.id, {
          attributes: ["id", "passwordResetToken"],
        });
        if (!reloadedUser?.passwordResetToken)
          throw new Error("Failed to verify persisted reset token.");

        console.log(`[${timestamp}] Reset token saved for user ${user.id}.`);
      } catch (updateError) {
        console.error(
          `[${timestamp}] ERROR during User.update() for reset token:`,
          updateError
        );
        return next(
          new ErrorHandler("Failed to save password reset token.", 500)
        );
      }

      await sendPasswordResetEmail(user.email, resetToken);
      res.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error(`[${timestamp}] Error in /forgot-password:`, error);
      if (!res.headersSent) next(new ErrorHandler("An error occurred.", 500));
    }
  }
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  applyLimiterIfNeeded(resetPasswordLimiter),
  validateResetPassword,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const { token: plaintextToken, newPassword } = req.body;
      console.log(`[${timestamp}] POST /api/auth/reset-password attempt.`);

      const potentialUsers = await User.findAll({
        where: { passwordResetToken: { [Op.ne]: null } },
      });
      console.log(
        `[${timestamp}] Found ${potentialUsers.length} potential users with non-null tokens.`
      );

      if (potentialUsers.length === 0) {
        console.warn(
          `[${timestamp}] No users found with non-null reset tokens.`
        );
        return next(
          new ErrorHandler(
            "Password reset token is invalid or has expired.",
            400
          )
        );
      }

      let user = null;
      for (const potentialUser of potentialUsers) {
        // Ensure passwordResetToken is not null before comparing
        if (potentialUser.passwordResetToken) {
          const isMatch = await bcrypt.compare(
            plaintextToken,
            potentialUser.passwordResetToken
          );
          if (isMatch) {
            if (
              potentialUser.passwordResetExpires &&
              potentialUser.passwordResetExpires > new Date()
            ) {
              user = potentialUser;
              console.log(
                `[${timestamp}] Token match found for user ID: ${user.id}`
              );
              break;
            } else {
              console.warn(
                `[${timestamp}] Token matched user ${potentialUser.id}, but expired.`
              );
            }
          }
        }
      }

      if (!user) {
        console.warn(`[${timestamp}] No matching non-expired token found.`);
        return next(
          new ErrorHandler(
            "Password reset token is invalid or has expired.",
            400
          )
        );
      }

      user.password = newPassword;
      user.needsPasswordChange = false;
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      user.refreshToken = null;

      console.log(
        `[${timestamp}] Calling user.save() for password update (hook will hash)...`
      );
      await user.save();

      console.log(
        `[${timestamp}] Password successfully reset for user ${user.id}`
      );
      res.json({
        message: "Password has been successfully reset. You can now log in.",
      });
    } catch (error) {
      console.error(`[${timestamp}] Error in /reset-password:`, error);
      next(error);
    }
  }
);

module.exports = router;
