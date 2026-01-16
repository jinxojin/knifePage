// server/routes/auth.js
const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const logger = require("../utils/logger");

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  process.env.NODE_ENV === "test"
    ? (req, res, next) => {
        logger.info(`Skipping rate limiter in test environment.`);
        next();
      }
    : resetLimiter,
  [body("email").isEmail().withMessage("Please enter a valid email address")],
  authController.forgotPassword
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("token").notEmpty().withMessage("Reset token is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  ],
  authController.resetPassword
);

module.exports = router;
