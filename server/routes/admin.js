// server/routes/admin.js
const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator"); // Added param
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sanitizeHtml = require("sanitize-html");

const Article = require("../models/article"); // Assuming models are correctly required elsewhere or adjust path
const User = require("../models/user"); // Assuming models are correctly required elsewhere or adjust path
const authenticateToken = require("../middleware/auth");
const ErrorHandler = require("../utils/errorHandler");

// --- Helper function to generate JWT ---
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // Short expiration time! 15 minutes
  );
}

// --- Admin Login ---
router.post(
  "/login",
  [
    body("username")
      .trim()
      .isLength({ min: 1 })
      .escape() // Keep escape for username input reflected elsewhere potentially
      .withMessage("Username is required"),
    body("password")
      .notEmpty() // Added notEmpty for robustness
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
    // Note: We don't escape the password itself before bcrypt comparison
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Log validation errors for debugging
      console.error("Login Validation Errors:", errors.array());
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const { username, password } = req.body;
      const user = await User.findOne({ where: { username } });

      if (!user) {
        console.log("User not found during login:", username);
        // Use a generic message for security
        return next(new ErrorHandler("Invalid credentials", 401));
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        console.log("Password comparison failed for user:", username);
        // Use a generic message for security
        return next(new ErrorHandler("Invalid credentials", 401));
      }

      // --- Generate Tokens ---
      const accessToken = generateAccessToken(user);
      const refreshToken = crypto.randomBytes(64).toString("hex");

      // --- Store Refresh Token in Database ---
      user.refreshToken = refreshToken;
      await user.save();

      console.log("Login successful for user:", username);
      res.json({ accessToken, refreshToken });
    } catch (err) {
      console.error("Login Error:", err); // Log the actual error
      next(err); // Pass to the central error handler
    }
  }
);

// --- Refresh Token Route ---
router.post(
  "/refresh",
  [
    // Added validation for refreshToken
    body("refreshToken")
      .isString()
      .withMessage("Refresh token must be a string") // Basic type check
      .notEmpty()
      .withMessage("Refresh token is required")
      .isLength({ min: 128, max: 128 }) // Check length (crypto.randomBytes(64).toString('hex') = 128 chars)
      .withMessage("Invalid refresh token format"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Refresh Token Validation Errors:", errors.array());
      // Potentially invalid token, treat as Forbidden or Bad Request
      return next(
        new ErrorHandler("Invalid refresh token provided", 400, errors.array())
      );
    }

    try {
      const { refreshToken } = req.body; // Use validated body
      const user = await User.findOne({ where: { refreshToken } });

      if (!user) {
        // Log this occurrence for security monitoring
        console.warn("Invalid refresh token presented:", refreshToken);
        // Don't give specific feedback, just forbid
        return next(new ErrorHandler("Invalid refresh token", 403));
      }

      // --- Generate a NEW access token ---
      const accessToken = generateAccessToken(user);

      // (Optional Security Enhancement: Implement refresh token rotation here)
      // 1. Generate a newRefreshToken = crypto.randomBytes(64).toString('hex');
      // 2. user.refreshToken = newRefreshToken;
      // 3. await user.save();
      // 4. res.json({ accessToken, refreshToken: newRefreshToken }); // Send both new tokens

      res.json({ accessToken }); // Send the new access token (without rotation for now)
    } catch (err) {
      console.error("Refresh Token Error:", err);
      next(err);
    }
  }
);

// --- Validation Middleware for Article Body ---
const validateArticleBody = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape() // Escape title as it might be rendered directly in HTML attributes/simple text
    .withMessage("Title must be between 5 and 255 characters"),
  body("content")
    .trim()
    .isLength({ min: 10 })
    // .escape() // REMOVED: Do not escape content meant for sanitize-html
    .withMessage("Content must be at least 10 characters long"),
  body("category")
    .isIn(["news", "competition", "blog"])
    .withMessage("Invalid category"),
  body("author")
    .trim()
    .isLength({ min: 1, max: 255 })
    .escape() // Escape author name
    .withMessage("Author is required and must be less than 255 chars"),
  body("imageUrl")
    .trim()
    .optional({ nullable: true, checkFalsy: true }) // Allows empty or null values
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Image URL must be a valid HTTP/HTTPS URL"),
];

// --- Validation Middleware for Article ID Parameter ---
const validateArticleId = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Article ID must be a positive integer")
    .toInt(), // Convert valid string ID to integer
];

// --- Create a new article (Admin-only) ---
router.post(
  "/articles",
  authenticateToken,
  validateArticleBody, // Apply validation middleware
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Create Article Validation Errors:", errors.array());
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      // Use destructured data from req.body (already validated)
      let { title, content, category, author, imageUrl } = req.body;

      // Sanitize the HTML content AFTER validation
      content = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          "img",
          "p",
          "strong",
          "em",
          "u",
          "s",
          "ul",
          "ol",
          "li",
          "a",
          "h1",
          "h2",
          "h3",
          "br",
        ]), // Allow common formatting tags + img
        allowedAttributes: {
          a: ["href", "name", "target", "rel"], // Allow rel for security (e.g., "noopener noreferrer")
          img: ["src", "alt", "title", "style", "width", "height"], // Allow basic img attributes
          // Allow styling for flexibility, but be cautious. Consider restricting specific properties.
          "*": ["class"], // Allow classes if needed for frontend styling
        },
        // Ensure only safe protocols are allowed, especially for images/links
        allowedSchemes: ["http", "https", "mailto"],
        allowedSchemesByTag: {
          // Ensure images only use http/https/data (data URIs might be large)
          img: ["data", "http", "https"],
        },
        // Add other sanitization options as needed, e.g., transformTags
      });

      const newArticle = await Article.create({
        title,
        content, // Use sanitized content
        category,
        author,
        imageUrl: imageUrl || null, // Ensure null if empty
      });

      console.log("Article created successfully:", newArticle.id);
      res.status(201).json(newArticle);
    } catch (err) {
      console.error("Create Article Error:", err);
      next(err);
    }
  }
);

// --- Update an Article ---
router.put(
  "/articles/:id",
  authenticateToken,
  validateArticleId, // Validate ID param first
  validateArticleBody, // Then validate body content
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Update Article Validation Errors:", errors.array());
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const articleId = req.params.id; // Already validated and converted to int by middleware
      const article = await Article.findByPk(articleId);

      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }

      // Use destructured data from req.body (already validated)
      let { title, content, category, author, imageUrl } = req.body;

      // Sanitize the HTML content AFTER validation
      content = sanitizeHtml(content, {
        /* ... same config as POST ... */
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          "img",
          "p",
          "strong",
          "em",
          "u",
          "s",
          "ul",
          "ol",
          "li",
          "a",
          "h1",
          "h2",
          "h3",
          "br",
        ]),
        allowedAttributes: {
          a: ["href", "name", "target", "rel"],
          img: ["src", "alt", "title", "style", "width", "height"],
          "*": ["class"],
        },
        allowedSchemes: ["http", "https", "mailto"],
        allowedSchemesByTag: { img: ["data", "http", "https"] },
      });

      await article.update({
        title,
        content,
        category,
        author,
        imageUrl: imageUrl || null, // Ensure null if empty
      });

      console.log("Article updated successfully:", articleId);
      res.json(article);
    } catch (err) {
      console.error(`Update Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

// --- Delete an Article ---
router.delete(
  "/articles/:id",
  authenticateToken,
  validateArticleId, // Validate ID param
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Although unlikely for a simple ID, good practice
      console.error("Delete Article Validation Errors:", errors.array());
      return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
    }

    try {
      const articleId = req.params.id; // Already validated and converted to int
      const article = await Article.findByPk(articleId);

      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }

      await article.destroy();

      console.log("Article deleted successfully:", articleId);
      // Standard practice for DELETE is often 204 No Content
      res.status(204).send();
      // Or if you prefer JSON: res.json({ message: "Article deleted successfully" });
    } catch (err) {
      console.error(`Delete Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

module.exports = router;
