// server/routes/admin.js
const express = require("express");
const router = express.Router();
const { body, param, validationResult, query } = require("express-validator"); // Added query
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sanitizeHtml = require("sanitize-html");

// Ensure models are correctly required
const { Article, User } = require("../models");
const authenticateToken = require("../middleware/auth");
const ErrorHandler = require("../utils/errorHandler");
// Import the new password generator utility
const generateTemporaryPassword = require("../utils/passwordGenerator");

// --- Helper function to generate JWT ---
function generateAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined!");
  }
  // Include role in the token payload
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: "15m" } // Access token expires quickly
  );
}

// --- Validation Middleware Definitions ---

const validateLoginBody = [
  /* ... keep as is ... */ body("username")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("Username is required"),
  body("password")
    .notEmpty()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];
const validateRefreshTokenBody = [
  /* ... keep as is ... */ body("refreshToken")
    .isString()
    .withMessage("Refresh token must be a string")
    .notEmpty()
    .withMessage("Refresh token is required")
    .isLength({ min: 128, max: 128 })
    .withMessage("Invalid refresh token format"),
];
const validateArticleBody = [
  /* ... keep as is ... */ body("title_en")
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape()
    .withMessage("English title must be between 5 and 255 characters"),
  body("content_en")
    .trim()
    .isLength({ min: 10 })
    .withMessage("English content must be at least 10 characters long"),
  body("excerpt_en")
    .trim()
    .optional({ nullable: !0, checkFalsy: !0 })
    .isLength({ max: 500 })
    .escape()
    .withMessage("English excerpt cannot exceed 500 characters"),
  body("title_rus")
    .optional({ nullable: !0, checkFalsy: !0 })
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape()
    .withMessage("Russian title must be between 5 and 255 characters"),
  body("content_rus")
    .optional({ nullable: !0, checkFalsy: !0 })
    .trim()
    .isLength({ min: 10 })
    .withMessage("Russian content must be at least 10 characters long"),
  body("excerpt_rus")
    .optional({ nullable: !0, checkFalsy: !0 })
    .trim()
    .isLength({ max: 500 })
    .escape()
    .withMessage("Russian excerpt cannot exceed 500 characters"),
  body("title_mng")
    .optional({ nullable: !0, checkFalsy: !0 })
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape()
    .withMessage("Mongolian title must be between 5 and 255 characters"),
  body("content_mng")
    .optional({ nullable: !0, checkFalsy: !0 })
    .trim()
    .isLength({ min: 10 })
    .withMessage("Mongolian content must be at least 10 characters long"),
  body("excerpt_mng")
    .optional({ nullable: !0, checkFalsy: !0 })
    .trim()
    .isLength({ max: 500 })
    .escape()
    .withMessage("Mongolian excerpt cannot exceed 500 characters"),
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
    .optional({ nullable: !0, checkFalsy: !0 })
    .isURL({ protocols: ["http", "https"], require_protocol: !0 })
    .withMessage("Image URL must be a valid HTTP/HTTPS URL"),
];
const validateArticleIdParam = [
  /* ... keep as is ... */ param("id")
    .isInt({ min: 1 })
    .withMessage("Article ID must be a positive integer")
    .toInt(),
];
const validateModeratorCreation = [
  /* ... keep as is ... */ body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores")
    .custom(async (value) => {
      const user = await User.findOne({ where: { username: value } });
      if (user) return Promise.reject("Username already in use");
    }),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail()
    .custom(async (value) => {
      const user = await User.findOne({ where: { email: value } });
      if (user) return Promise.reject("Email already in use");
    }),
];

// --- Middleware for checking Admin Role ---
const isAdmin = async (req, res, next) => {
  // Assumes authenticateToken middleware runs before this and adds req.user
  if (!req.user || req.user.role !== "admin") {
    console.warn(
      `[ADMIN CHECK] Forbidden: User ${req.user?.userId || "Unknown"} (Role: ${
        req.user?.role || "N/A"
      }) attempted admin action.`
    );
    return next(new ErrorHandler("Forbidden: Admin role required", 403));
  }
  next(); // User is admin
};

// --- Route Handlers ---

// POST /api/admin/login
router.post("/login", validateLoginBody, async (req, res, next) => {
  /* ... keep implementation, including needsPasswordChange check ... */ const errors =
    validationResult(req);
  if (!errors.isEmpty())
    return next(new ErrorHandler("Validation Error", 400, errors.array()));
  try {
    const { username: username, password: password } = req.body;
    const user = await User.findOne({ where: { username: username } });
    const match = user ? await bcrypt.compare(password, user.password) : !1;
    if (!user || !match)
      return (
        console.log(`Login failed for username: ${username}`),
        next(new ErrorHandler("Invalid credentials", 401))
      );
    if (user.needsPasswordChange)
      return (
        console.log(
          `Login attempt for user ${username} requires password change.`
        ),
        res.status(400).json({
          message: "Password change required.",
          needsPasswordChange: !0,
        })
      );
    const accessToken = generateAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString("hex");
    user.refreshToken = refreshToken;
    await user.save();
    console.log(`Login successful for user: ${username}`);
    res.json({ accessToken: accessToken, refreshToken: refreshToken });
  } catch (err) {
    console.error("Login Error:", err);
    next(err);
  }
});

// POST /api/admin/refresh
router.post("/refresh", validateRefreshTokenBody, async (req, res, next) => {
  /* ... keep implementation, including needsPasswordChange check ... */ const errors =
    validationResult(req);
  if (!errors.isEmpty())
    return next(
      new ErrorHandler("Invalid refresh token provided", 400, errors.array())
    );
  try {
    const { refreshToken: refreshToken } = req.body;
    const user = await User.findOne({ where: { refreshToken: refreshToken } });
    if (!user) return next(new ErrorHandler("Invalid refresh token", 403));
    if (user.needsPasswordChange)
      return (
        console.warn(
          `Refresh attempt by user ${user.username} who needs password change.`
        ),
        next(
          new ErrorHandler(
            "Password change required before refreshing token",
            403
          )
        )
      );
    const accessToken = generateAccessToken(user);
    res.json({ accessToken: accessToken });
  } catch (err) {
    console.error("Refresh Token Error:", err);
    next(err);
  }
});

// GET /api/admin/me (Get current user info)
router.get("/me", authenticateToken, async (req, res, next) => {
  /* ... keep implementation ... */ try {
    if (!req.user || !req.user.userId)
      return next(new ErrorHandler("User information not found in token", 401));
    console.log(
      `[ADMIN ME] Sending user info for ${req.user.userId} from token:`,
      req.user
    );
    res.json({
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
    });
  } catch (error) {
    console.error("[ADMIN ME] Error fetching user info:", error);
    next(error);
  }
});

// GET /api/admin/users (List Users - Admin Only)
router.get(
  "/users",
  authenticateToken, // Must be logged in
  isAdmin, // Must be admin
  query("role").optional().isIn(["admin", "moderator"]), // Optional filter validation
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] GET /api/admin/users - Request Query:`,
      req.query
    );
    try {
      const whereClause = {};
      if (req.query.role) {
        whereClause.role = req.query.role;
      } // Apply filter if present
      console.log(
        `[${timestamp}] GET /api/admin/users - Fetching users with filter:`,
        whereClause
      );
      const users = await User.findAll({
        where: whereClause,
        attributes: [
          "id",
          "username",
          "email",
          "role",
          "createdAt",
          "needsPasswordChange",
        ], // Safe attributes
        order: [["username", "ASC"]],
      });
      console.log(
        `[${timestamp}] GET /api/admin/users - Found ${users.length} users.`
      );
      res.json(users);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /api/admin/users - Error listing users:`,
        error
      );
      next(error);
    }
  }
);

// POST /api/admin/users (Create Moderator - Admin Only)
router.post(
  "/users",
  authenticateToken, // Must be logged in
  isAdmin, // Must be admin
  validateModeratorCreation, // Validate input
  async (req, res, next) => {
    // Errors handled by middleware, proceed
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] POST /api/admin/users - Request Body:`,
      req.body
    );
    try {
      const { username, email } = req.body;
      const temporaryPassword = generateTemporaryPassword();
      if (process.env.NODE_ENV !== "production") {
        console.log(`Temp password for ${username}: ${temporaryPassword}`);
      } else {
        console.log(`Generated temp password for ${username}`);
      }

      const newUser = await User.create({
        username,
        email,
        password: temporaryPassword, // Hashed by hook
        role: "moderator",
        needsPasswordChange: true,
      });
      console.log(
        `[${timestamp}] POST /api/admin/users - Moderator user created successfully:`,
        { id: newUser.id, username: newUser.username }
      );
      res.status(201).json({
        message: "Moderator created successfully.",
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        temporaryPassword: temporaryPassword, // Return temp password for admin
      });
    } catch (error) {
      console.error(
        `[${timestamp}] POST /api/admin/users - Error creating user:`,
        error
      );
      if (error.name === "SequelizeUniqueConstraintError") {
        return next(new ErrorHandler("Username or email already exists.", 409));
      }
      next(error);
    }
  }
);

// --- Article Management Routes (Admin Only - apply isAdmin middleware) ---

// POST /api/admin/articles
router.post(
  "/articles",
  authenticateToken,
  isAdmin,
  validateArticleBody,
  async (req, res, next) => {
    // ... (Keep existing article creation logic) ...
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    try {
      let {
        title_en: title_en,
        content_en: content_en,
        excerpt_en: excerpt_en,
        title_rus: title_rus,
        content_rus: content_rus,
        excerpt_rus: excerpt_rus,
        title_mng: title_mng,
        content_mng: content_mng,
        excerpt_mng: excerpt_mng,
        category: category,
        author: author,
        imageUrl: imageUrl,
      } = req.body;
      const sanitizeOptions = {
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
      };
      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);
      const newArticle = await Article.create({
        title_en: title_en,
        content_en: content_en,
        excerpt_en: excerpt_en,
        title_rus: title_rus,
        content_rus: content_rus,
        excerpt_rus: excerpt_rus,
        title_mng: title_mng,
        content_mng: content_mng,
        excerpt_mng: excerpt_mng,
        category: category,
        author: author,
        imageUrl: imageUrl || null,
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
  isAdmin,
  validateArticleIdParam,
  validateArticleBody,
  async (req, res, next) => {
    // ... (Keep existing article update logic) ...
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    try {
      const articleId = req.params.id;
      const article = await Article.findByPk(articleId);
      if (!article) return next(new ErrorHandler("Article not found", 404));
      let {
        title_en: title_en,
        content_en: content_en,
        excerpt_en: excerpt_en,
        title_rus: title_rus,
        content_rus: content_rus,
        excerpt_rus: excerpt_rus,
        title_mng: title_mng,
        content_mng: content_mng,
        excerpt_mng: excerpt_mng,
        category: category,
        author: author,
        imageUrl: imageUrl,
      } = req.body;
      const sanitizeOptions = {
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
      };
      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);
      await article.update({
        title_en: title_en,
        content_en: content_en,
        excerpt_en: excerpt_en,
        title_rus: title_rus,
        content_rus: content_rus,
        excerpt_rus: excerpt_rus,
        title_mng: title_mng,
        content_mng: content_mng,
        excerpt_mng: excerpt_mng,
        category: category,
        author: author,
        imageUrl: imageUrl || null,
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
  isAdmin,
  validateArticleIdParam,
  async (req, res, next) => {
    // ... (Keep existing article delete logic) ...
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
    try {
      const articleId = req.params.id;
      const article = await Article.findByPk(articleId);
      if (!article) return next(new ErrorHandler("Article not found", 404));
      await article.destroy();
      console.log("Article deleted successfully:", articleId);
      res.status(204).send();
    } catch (err) {
      console.error(`Delete Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

module.exports = router;
