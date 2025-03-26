// server/routes/admin.js
const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator"); // Added param
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sanitizeHtml = require("sanitize-html");

// Assuming models are correctly required via ../models index or adjust path if needed
const { Article, User } = require("../models");
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

// --- Validation Middleware Definitions ---

const validateLoginBody = [
  body("username")
    .trim()
    .isLength({ min: 1 })
    .escape() // Keep escape for username input reflected elsewhere potentially
    .withMessage("Username is required"),
  body("password")
    .notEmpty() // Added notEmpty for robustness
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];

const validateRefreshTokenBody = [
  body("refreshToken")
    .isString()
    .withMessage("Refresh token must be a string")
    .notEmpty()
    .withMessage("Refresh token is required")
    .isLength({ min: 128, max: 128 }) // crypto.randomBytes(64).toString('hex') = 128 chars
    .withMessage("Invalid refresh token format"),
];

const validateArticleBody = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape()
    .withMessage("Title must be between 5 and 255 characters"),
  body("content")
    .trim()
    .isLength({ min: 10 })
    // REMOVED .escape() - rely on sanitize-html
    .withMessage("Content must be at least 10 characters long"),
  body("category")
    .isIn(["news", "competition", "blog"])
    .withMessage("Invalid category"),
  body("author")
    .trim()
    .isLength({ min: 1, max: 255 })
    .escape()
    .withMessage("Author is required and must be less than 255 chars"),
  body("imageUrl")
    .trim()
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Image URL must be a valid HTTP/HTTPS URL"),
  body("excerpt")
    .trim()
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 }) // Example max length
    .withMessage("Excerpt cannot exceed 500 characters")
    .escape(), // Escape plain text excerpt
];

const validateArticleIdParam = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Article ID must be a positive integer")
    .toInt(),
];

// --- Route Handlers ---

// POST /api/admin/login
router.post("/login", validateLoginBody, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Login Validation Errors:", errors.array());
    return next(new ErrorHandler("Validation Error", 400, errors.array()));
  }
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user) {
      console.log("User not found during login:", username);
      return next(new ErrorHandler("Invalid credentials", 401));
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log("Password comparison failed for user:", username);
      return next(new ErrorHandler("Invalid credentials", 401));
    }
    const accessToken = generateAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString("hex");
    user.refreshToken = refreshToken;
    await user.save();
    console.log("Login successful for user:", username);
    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error("Login Error:", err);
    next(err);
  }
});

// POST /api/admin/refresh
router.post("/refresh", validateRefreshTokenBody, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Refresh Token Validation Errors:", errors.array());
    return next(
      new ErrorHandler("Invalid refresh token provided", 400, errors.array())
    );
  }
  try {
    const { refreshToken } = req.body;
    const user = await User.findOne({ where: { refreshToken } });
    if (!user) {
      console.warn("Invalid refresh token presented:", refreshToken);
      return next(new ErrorHandler("Invalid refresh token", 403));
    }
    const accessToken = generateAccessToken(user);
    // Optional: Add refresh token rotation here
    res.json({ accessToken });
  } catch (err) {
    console.error("Refresh Token Error:", err);
    next(err);
  }
});

// POST /api/admin/articles
router.post(
  "/articles",
  authenticateToken,
  validateArticleBody,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Create Article Validation Errors:", errors.array());
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }
    try {
      let { title, content, category, author, imageUrl, excerpt } = req.body; // Include excerpt
      content = sanitizeHtml(content, {
        /* Add your full sanitize-html config here */
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
      const newArticle = await Article.create({
        title,
        content,
        category,
        author,
        imageUrl: imageUrl || null,
        excerpt, // Include excerpt
      });
      console.log("Article created successfully:", newArticle.id);
      res.status(201).json(newArticle);
    } catch (err) {
      console.error("Create Article Error:", err);
      next(err);
    }
  }
);

// PUT /api/admin/articles/:id
router.put(
  "/articles/:id",
  authenticateToken,
  validateArticleIdParam, // Combined param and body validation
  validateArticleBody,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Update Article Validation Errors:", errors.array());
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }
    try {
      const articleId = req.params.id; // ID is validated
      const article = await Article.findByPk(articleId);
      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }
      let { title, content, category, author, imageUrl, excerpt } = req.body; // Include excerpt
      content = sanitizeHtml(content, {
        /* Add your full sanitize-html config here */
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
        imageUrl: imageUrl || null,
        excerpt, // Include excerpt
      });
      console.log("Article updated successfully:", articleId);
      res.json(article);
    } catch (err) {
      console.error(`Update Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

// DELETE /api/admin/articles/:id
router.delete(
  "/articles/:id",
  authenticateToken,
  validateArticleIdParam, // Validate ID param
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Delete Article Validation Errors:", errors.array());
      return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
    }
    try {
      const articleId = req.params.id; // ID is validated
      const article = await Article.findByPk(articleId);
      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }
      await article.destroy();
      console.log("Article deleted successfully:", articleId);
      res.status(204).send(); // No Content response
    } catch (err) {
      console.error(`Delete Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

module.exports = router;
