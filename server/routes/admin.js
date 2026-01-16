// server/routes/admin.js
const express = require("express");
const router = express.Router();
const { body, param, query } = require("express-validator");
const adminController = require("../controllers/adminController");
const authenticateToken = require("../middleware/auth");
const ErrorHandler = require("../utils/errorHandler");
const logger = require("../utils/logger");

// --- Middlewares ---
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    logger.warn(`Access denied for user ${req.user.username} (role: ${req.user.role}) - Admin required.`);
    return next(new ErrorHandler("Forbidden: Admin role required", 403));
  }
  next();
};

const isModeratorOrAdmin = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "moderator") {
    logger.warn(`Access denied for user ${req.user.username} (role: ${req.user.role}) - Moderator or Admin required.`);
    return next(new ErrorHandler("Forbidden: Moderator or Admin role required", 403));
  }
  next();
};

const validateArticle = [
  body("category").isIn(["news", "competition", "blog"]).withMessage("Invalid category"),
  body("author").notEmpty().withMessage("Author is required"),
  body("status").optional().isIn(["published", "draft"]).withMessage("Invalid status"),
  body("imageUrl").optional().isURL().withMessage("Image URL must be valid"),
  body("title_en").notEmpty().withMessage("English Title is required"),
  body("content_en").notEmpty().withMessage("English Content is required"),
];

const validateRefreshTokenBody = [
  body("refreshToken")
    .isString()
    .withMessage("Refresh token must be a string")
    .notEmpty()
    .withMessage("Refresh token is required"),
];

// --- Authentication Routes ---
router.post("/login", [
  body("username").notEmpty().withMessage("Username is required"),
  body("password").notEmpty().withMessage("Password is required"),
], adminController.login);

router.post("/refresh-token", validateRefreshTokenBody, adminController.refreshToken);
router.post("/refresh", validateRefreshTokenBody, adminController.refreshToken); // Add alias for tests

router.get("/me", authenticateToken, adminController.getMe);

// --- Article Management ---
router.get("/articles", authenticateToken, isModeratorOrAdmin, adminController.getArticles);
router.get("/articles/:id", authenticateToken, isModeratorOrAdmin, adminController.getArticleById);
router.post("/articles", authenticateToken, isModeratorOrAdmin, validateArticle, adminController.createArticle);
router.put("/articles/:id", authenticateToken, isModeratorOrAdmin, validateArticle, adminController.updateArticle);
router.delete("/articles/:id", authenticateToken, isModeratorOrAdmin, adminController.deleteArticle);

// --- Suggestion System ---
router.post("/articles/:id/suggest", authenticateToken, isModeratorOrAdmin, validateArticle, adminController.suggestEdit);
router.post("/articles/suggest-new", authenticateToken, isModeratorOrAdmin, validateArticle, adminController.suggestNew);
router.get("/suggestions", authenticateToken, isAdmin, adminController.getAllSuggestions);
router.get("/suggestions/my", authenticateToken, adminController.getMySuggestions);
router.get("/suggestions/:suggestionId", authenticateToken, isAdmin, adminController.getSuggestionById);
router.post("/suggestions/:suggestionId/approve", authenticateToken, isAdmin, adminController.approveSuggestion);
router.post("/suggestions/:suggestionId/reject", authenticateToken, isAdmin, adminController.rejectSuggestion);

// --- User Management (Admins Only) ---
router.get("/users", authenticateToken, isAdmin, adminController.getUsers);
router.post("/users", authenticateToken, isAdmin, [
  body("username").isLength({ min: 3 }).withMessage("Username at least 3 chars"),
  body("email").isEmail().withMessage("Valid email required"),
  body("role").isIn(["moderator", "admin"]).withMessage("Invalid role"),
  body("password").isLength({ min: 8 }).withMessage("Password at least 8 chars"),
], adminController.createUser);
router.delete("/users/:id", authenticateToken, isAdmin, adminController.deleteUser);

module.exports = router;