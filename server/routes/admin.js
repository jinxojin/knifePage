// server/routes/admin.js
const express = require("express");
const router = express.Router();
const { body, param, validationResult, query } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sanitizeHtml = require("sanitize-html");

// Ensure models AND sequelize instance are correctly required AT THE TOP
const { Article, User, SuggestedEdit, sequelize } = require("../models");
const { Op } = require("sequelize"); // Make sure Op is imported

const authenticateToken = require("../middleware/auth");
const ErrorHandler = require("../utils/errorHandler");
const generateTemporaryPassword = require("../utils/passwordGenerator");

// --- Helper function to generate JWT ---
function generateAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined!");
    // In a real app, might throw or handle this more gracefully
  }
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: "15m" } // Access token expires quickly
  );
}

// --- Validation Middleware Definitions ---
const validateLoginBody = [
  body("username")
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
  body("refreshToken")
    .isString()
    .withMessage("Refresh token must be a string")
    .notEmpty()
    .withMessage("Refresh token is required")
    // Assuming hex encoding, 64 bytes = 128 hex characters
    .isLength({ min: 128, max: 128 })
    .withMessage("Invalid refresh token format"),
];

// Corrected validateArticleBody
const validateArticleBody = [
  body("title_en")
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape()
    .withMessage("English title must be between 5 and 255 characters"),

  body("content_en") // REQUIRED field
    .trim()
    .notEmpty() // Ensure it's not empty after trimming
    .withMessage("English content is required"),

  body("excerpt_en")
    .trim()
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 })
    .escape()
    .withMessage("English excerpt cannot exceed 500 characters"),

  // Optional fields validations
  body("title_rus")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape()
    .withMessage("Russian title must be between 5 and 255 characters"),

  body("content_rus") // OPTIONAL field
    .optional({ nullable: true, checkFalsy: true }) // Mark as optional first
    .trim()
    .notEmpty() // THEN validate: if provided, it shouldn't be empty after trim
    .withMessage("Russian content cannot be empty if provided"), // Adjusted message

  body("excerpt_rus")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .escape()
    .withMessage("Russian excerpt cannot exceed 500 characters"),

  body("title_mng")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 5, max: 255 })
    .escape()
    .withMessage("Mongolian title must be between 5 and 255 characters"),

  body("content_mng") // OPTIONAL field
    .optional({ nullable: true, checkFalsy: true }) // Mark as optional first
    .trim()
    .notEmpty() // THEN validate: if provided, it shouldn't be empty after trim
    .withMessage("Mongolian content cannot be empty if provided"), // Adjusted message

  body("excerpt_mng")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .escape()
    .withMessage("Mongolian excerpt cannot exceed 500 characters"),

  // Required common fields
  body("category")
    .notEmpty() // Ensure category is not empty
    .isIn(["news", "competition", "blog"])
    .withMessage("Invalid category selected"),

  body("author")
    .trim()
    .isLength({ min: 1, max: 255 }) // Ensures author is not empty
    .escape()
    .withMessage("Author is required and must be less than 255 chars"),

  body("imageUrl")
    .trim()
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Image URL must be a valid HTTP/HTTPS URL"),
];

const validateArticleIdParam = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Article ID must be a positive integer")
    .toInt(),
];
const validateModeratorCreation = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be 3-50 chars")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, underscores")
    .custom(async (value, { req }) => {
      // Keep async check for username
      const testId = req.body?.username || req.path;
      try {
        // console.log(`[Validator][${testId}] Checking username: ${value}`);
        const user = await User.findOne({ where: { username: value } });
        if (user) {
          // console.error(`---> [Validator][${testId}] Username ${value} FOUND, throwing.`);
          throw new Error("Username already in use"); // Use throw
        }
        // console.log(`[Validator][${testId}] Username ${value} unique.`);
      } catch (error) {
        // console.error(`---> [Validator][${testId}] DB Error during username check:`, error.message);
        if (error.message === "Username already in use") throw error; // Re-throw specific validation error
        throw new Error("Database error during username check"); // Throw generic for others
      }
    }),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    //.normalizeEmail() // Be cautious with normalizeEmail if it causes issues
    .custom(async (value, { req }) => {
      const testId = req.body?.username || req.path;
      try {
        console.log(`[Validator][${testId}] Checking email: ${value}`);
        const user = await User.findOne({ where: { email: value } });
        if (user) {
          console.error(
            `---> [Validator][${testId}] Email ${value} FOUND (ID: ${user.id}), THROWING error.`
          );
          throw new Error("Email already in use"); // Use throw
        }
        console.log(`[Validator][${testId}] Email ${value} is unique.`);
      } catch (error) {
        console.error(
          `---> [Validator][${testId}] DB Error during email check for ${value}:`,
          error.message
        );
        if (error.message === "Email already in use") throw error; // Re-throw specific validation error
        throw new Error("Database error during email check"); // Throw generic for others
      }
    }),
];

const validateForcePasswordChange = [
  body("changePasswordToken")
    .notEmpty()
    .withMessage("Change token is required."),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long."),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Password confirmation does not match password");
    }
    return true;
  }),
];

const validateUserIdParam = [
  param("userId")
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer")
    .toInt(),
];

// --- Middleware for checking Role ---
const isAdmin = async (req, res, next) => {
  // Assumes authenticateToken middleware has run and set req.user
  if (!req.user || req.user.role !== "admin") {
    console.warn(
      `[ADMIN CHECK] Forbidden: User ${req.user?.userId || "Unknown"} (Role: ${
        req.user?.role || "N/A"
      }) attempted admin action.`
    );
    return next(new ErrorHandler("Forbidden: Admin role required", 403));
  }
  next();
};
const isModeratorOrAdmin = async (req, res, next) => {
  if (!req.user || !["admin", "moderator"].includes(req.user.role)) {
    console.warn(
      `[MOD CHECK] Forbidden: User ${req.user?.userId || "Unknown"} (Role: ${
        req.user?.role || "N/A"
      }) attempted moderator action.`
    );
    return next(
      new ErrorHandler("Forbidden: Moderator or Admin role required", 403)
    );
  }
  next();
};

// Define sanitize options once
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
    "span", // Allow span for potential styling/classes from editor
    "div", // Allow div for structure
  ]),
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "style", "width", "height", "class"], // Added class
    span: ["style", "class"], // Allow style/class on span
    p: ["style", "class"], // Allow style/class on p
    div: ["style", "class"], // Allow style/class on div
    "*": ["class"], // Allow class globally
  },
  allowedStyles: {
    "*": {
      "text-align": [/^left$/, /^center$/, /^right$/, /^justify$/],
      color: [
        /^#(?:[0-9a-fA-F]{3}){1,2}$/,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      "background-color": [
        /^#(?:[0-9a-fA-F]{3}){1,2}$/,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      float: [/^left$/, /^right$/],
      margin: [/^\d+px$/],
      "margin-left": [/^\d+px$/],
      "margin-right": [/^\d+px$/],
      "margin-top": [/^\d+px$/],
      "margin-bottom": [/^\d+px$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["data", "http", "https"] },
  selfClosing: ["img", "br", "hr"],
  allowComments: false,
};

// --- Route Handlers ---

// POST /api/admin/login
router.post("/login", validateLoginBody, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorHandler("Validation Error", 400, errors.array()));
  }

  try {
    const { username, password } = req.body;
    console.log(`[Login Server] Attempting login for username: ${username}`);

    const user = await User.findOne({ where: { username } });

    if (!user) {
      console.log(`[Login Server] User not found: ${username}`);
      return next(new ErrorHandler("Invalid credentials", 401));
    }

    console.log(
      `[Login Server] User found. Comparing password for user ID: ${user.id}`
    );
    const match = await user.validPassword(password); // Use instance method
    console.log(`[Login Server] bcrypt.compare result (match): ${match}`);

    if (!match) {
      console.log(
        `[Login Server] Password comparison failed for user: ${username}`
      );
      return next(new ErrorHandler("Invalid credentials", 401));
    }

    console.log(`[Login Server] Password matches for user: ${username}`);

    // Check if password change is required *after* successful login
    if (user.needsPasswordChange) {
      console.log(`[Login Server] User ${username} requires password change.`);
      const changePasswordToken = jwt.sign(
        { userId: user.id, purpose: "force-change-password" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );
      // IMPORTANT: Use status 400 for this specific condition as per client expectation
      return res.status(400).json({
        message: "Password change required. Please set a new password.",
        needsPasswordChange: true,
        changePasswordToken: changePasswordToken,
      });
    }

    // If password is valid and no change needed, issue tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString("hex");

    user.refreshToken = refreshToken;
    user.needsPasswordChange = false;
    await user.save();

    console.log(
      `[Login Server] Login successful for user: ${username}. Issuing tokens.`
    );
    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error("[Login Server] Error during login process:", err);
    next(err); // Pass to global error handler
  }
});

// POST /api/admin/refresh
router.post("/refresh", validateRefreshTokenBody, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ErrorHandler("Invalid refresh token provided", 400, errors.array())
    );
  }

  try {
    const { refreshToken } = req.body;
    const user = await User.findOne({ where: { refreshToken } });

    if (!user) {
      return next(new ErrorHandler("Invalid refresh token", 403));
    }

    if (user.needsPasswordChange) {
      console.warn(
        `Refresh attempt by user ${user.username} who needs password change.`
      );
      return next(
        new ErrorHandler(
          "Password change required before refreshing token",
          403
        )
      );
    }

    console.log(
      `Generating new access token for user ${user.username} during refresh.`
    );
    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("Refresh Token Error:", err);
    next(err);
  }
});

// GET /api/admin/me
router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return next(new ErrorHandler("User information not found in token", 401));
    }
    console.log(
      `[ADMIN ME] Sending user info for ${req.user.userId} from token:`,
      req.user
    );
    res.json({
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
    });
  } catch (err) {
    console.error("[ADMIN ME] Error fetching user info:", err);
    next(err);
  }
});

// GET /api/admin/users
router.get(
  "/users",
  authenticateToken,
  isAdmin,
  query("role").optional().isIn(["admin", "moderator"]),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] GET /api/admin/users - Query:`, req.query);
    try {
      const filter = {};
      if (req.query.role) {
        filter.role = req.query.role;
      }
      console.log(
        `[${timestamp}] GET /api/admin/users - Fetching filter:`,
        filter
      );
      const users = await User.findAll({
        where: filter,
        attributes: [
          "id",
          "username",
          "email",
          "role",
          "createdAt",
          "needsPasswordChange",
        ],
        order: [["username", "ASC"]],
      });
      console.log(
        `[${timestamp}] GET /api/admin/users - Found ${users.length} users.`
      );
      res.json(users);
    } catch (error) {
      console.error(`[${timestamp}] GET /api/admin/users - Error:`, error);
      next(error);
    }
  }
);

// POST /api/admin/users (Create Moderator)
router.post(
  "/users",
  authenticateToken,
  isAdmin,
  validateModeratorCreation,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const requestIdentifier = req.body?.username || "UNKNOWN_USER";
    console.log(
      `[${timestamp}] Handler POST /api/admin/users [${requestIdentifier}] - Start.`
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(
        `---> [${timestamp}][${requestIdentifier}] Validation Errors Found. STOPPING request. Errors:`,
        JSON.stringify(errors.array())
      );
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    console.log(
      `[${timestamp}][${requestIdentifier}] ALL Validation PASSED. Proceeding to create user...`
    );

    try {
      const { username, email } = req.body;
      const temporaryPassword = generateTemporaryPassword();
      console.log(`Temp password for ${username}: ${temporaryPassword}`);

      const newUser = await User.create({
        username,
        email,
        password: temporaryPassword,
        role: "moderator",
        needsPasswordChange: true, // Default for new moderators
      });

      console.log(`[${timestamp}][${requestIdentifier}] Moderator created:`, {
        id: newUser.id,
        username: newUser.username,
      });

      // === FIX: Add message to response ===
      res.status(201).json({
        message: "Moderator created successfully.", // Added message
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        temporaryPassword: temporaryPassword,
      });
      // === END FIX ===
    } catch (error) {
      console.error(
        `[${timestamp}][${requestIdentifier}] Error during User.create:`,
        error
      );
      if (error.name === "SequelizeUniqueConstraintError") {
        return next(
          new ErrorHandler(
            `Username or email already exists (DB Constraint).`,
            409
          )
        );
      }
      next(error);
    }
  }
);

// POST /api/admin/force-change-password
router.post(
  "/force-change-password",
  validateForcePasswordChange,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] POST /api/admin/force-change-password attempt.`
    );
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] Force Change PW Validation Errors:`,
        errors.array()
      );
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const { changePasswordToken, newPassword } = req.body;

      let decodedToken;
      try {
        decodedToken = jwt.verify(changePasswordToken, process.env.JWT_SECRET);
        if (decodedToken.purpose !== "force-change-password") {
          throw new Error("Invalid token purpose");
        }
      } catch (jwtError) {
        console.warn(
          `[${timestamp}] Force Change PW - Invalid/Expired Token:`,
          jwtError.message
        );
        return next(
          new ErrorHandler("Invalid or expired password change token.", 401)
        );
      }

      const userId = decodedToken.userId;
      const user = await User.findByPk(userId);

      if (!user) {
        console.error(
          `[${timestamp}] Force Change PW - User ${userId} not found!`
        );
        return next(new ErrorHandler("User not found.", 404));
      }

      if (!user.needsPasswordChange) {
        console.warn(
          `[${timestamp}] Force Change PW - User ${userId} no longer needs change.`
        );
        return res
          .status(400)
          .json({ message: "Password has already been changed." });
      }

      user.password = newPassword;
      user.needsPasswordChange = false;
      await user.save(); // This triggers the beforeUpdate hook

      console.log(
        `[${timestamp}] Force Change PW - Success for user ${userId}.`
      );
      res.status(200).json({
        message:
          "Password successfully changed. Please log in with your new password.",
      });
    } catch (error) {
      console.error(`[${timestamp}] Force Change PW - Error:`, error);
      next(error);
    }
  }
);

// --- Article Management Routes (Admin Only) ---

// POST /api/admin/articles
router.post(
  "/articles",
  authenticateToken,
  isAdmin,
  validateArticleBody,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      let {
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl,
      } = req.body;

      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      if (!title_en?.trim())
        return next(new ErrorHandler("English title is required.", 400));
      if (!content_en?.trim())
        return next(new ErrorHandler("English content is required.", 400));
      if (!category?.trim() || !author?.trim())
        return next(new ErrorHandler("Category and Author are required.", 400));

      const newArticle = await Article.create({
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl: imageUrl || null,
        status: "published",
        views: 0,
      });
      console.log("Article created by admin:", newArticle.id);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const articleId = req.params.id;
      const article = await Article.findByPk(articleId);

      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }

      let {
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl,
      } = req.body;

      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      if (
        !title_en?.trim() ||
        !content_en?.trim() ||
        !category?.trim() ||
        !author?.trim()
      ) {
        return next(
          new ErrorHandler(
            "English Title, English Content, Category, and Author are required.",
            400
          )
        );
      }

      await article.update({
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl: imageUrl || null,
      });

      console.log("Article updated by admin:", articleId);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
    }

    try {
      const articleId = req.params.id;
      const article = await Article.findByPk(articleId);

      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }

      await article.destroy();
      console.log("Article deleted by admin:", articleId);
      res.status(204).send();
    } catch (err) {
      console.error(`Delete Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

// DELETE /api/admin/users/:userId
router.delete(
  "/users/:userId",
  authenticateToken,
  isAdmin,
  validateUserIdParam,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const userIdToDelete = req.params.userId;
    const adminUserId = req.user.userId;

    console.log(
      `[${timestamp}] DELETE /api/admin/users/${userIdToDelete} - Attempt by Admin ID: ${adminUserId}`
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler("Invalid User ID", 400, errors.array()));
    }

    if (userIdToDelete === adminUserId) {
      console.warn(
        `[${timestamp}] Admin ID: ${adminUserId} attempted to delete themselves.`
      );
      return next(
        new ErrorHandler("Administrators cannot delete their own account.", 403)
      );
    }

    try {
      const userToDelete = await User.findByPk(userIdToDelete);

      if (!userToDelete) {
        console.warn(
          `[${timestamp}] User ID: ${userIdToDelete} not found for deletion.`
        );
        return next(new ErrorHandler("User not found", 404));
      }

      if (userToDelete.role === "admin") {
        console.warn(
          `[${timestamp}] Admin ID: ${adminUserId} attempted to delete another admin (ID: ${userIdToDelete}). This action might be restricted.`
        );
        return next(
          new ErrorHandler("Cannot delete another administrator account.", 403)
        );
      }

      await userToDelete.destroy();
      console.log(
        `[${timestamp}] User ID: ${userIdToDelete} (Role: ${userToDelete.role}) deleted successfully by Admin ID: ${adminUserId}.`
      );

      res.status(204).send();
    } catch (error) {
      console.error(
        `[${timestamp}] Error deleting user ID: ${userIdToDelete}:`,
        error
      );
      next(error);
    }
  }
);

// --- Suggestion Routes (Moderator/Admin) ---

// POST /api/admin/articles/:id/suggest (Suggest Edit for Existing Article)
router.post(
  "/articles/:id/suggest",
  authenticateToken,
  isModeratorOrAdmin,
  validateArticleIdParam,
  validateArticleBody,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const articleIdToEdit = req.params.id;
    const moderatorId = req.user.userId;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] Suggest Edit Validation Errors:`,
        errors.array()
      );
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }
    console.log(
      `[${timestamp}] POST /api/admin/articles/${articleIdToEdit}/suggest - User ${moderatorId} submitting suggestion.`
    );

    try {
      const targetArticle = await Article.findByPk(articleIdToEdit, {
        attributes: ["id", "status"],
      });
      if (!targetArticle) {
        console.warn(
          `[${timestamp}] Suggest Edit - Target article ${articleIdToEdit} not found.`
        );
        return next(new ErrorHandler("Article to edit not found", 404));
      }

      let {
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl,
      } = req.body;

      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      if (
        !title_en?.trim() ||
        !content_en?.trim() ||
        !category?.trim() ||
        !author?.trim()
      ) {
        return next(
          new ErrorHandler(
            "Suggestion requires at least English Title, English Content, Category, and Author.",
            400
          )
        );
      }

      const proposedDataPayload = {
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl: imageUrl || null,
      };

      const newSuggestion = await SuggestedEdit.create({
        articleId: articleIdToEdit,
        moderatorId: moderatorId,
        proposedData: proposedDataPayload,
        status: "pending",
      });

      console.log(
        `[${timestamp}] Suggestion created (ID: ${newSuggestion.id}) for Article ${articleIdToEdit} by User ${moderatorId}.`
      );
      res.status(201).json({
        message:
          "Edit suggestion submitted successfully and is pending review.",
        suggestionId: newSuggestion.id,
      });
    } catch (error) {
      console.error(
        `[${timestamp}] POST /api/admin/articles/${articleIdToEdit}/suggest - Error:`,
        error
      );
      next(error);
    }
  }
);

// POST /api/admin/articles/suggest-new (Suggest a New Article)
router.post(
  "/articles/suggest-new",
  authenticateToken,
  isModeratorOrAdmin,
  validateArticleBody,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const moderatorId = req.user.userId;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] Suggest New Validation Errors:`,
        errors.array()
      );
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }
    console.log(
      `[${timestamp}] POST /api/admin/articles/suggest-new - User ${moderatorId} submitting NEW suggestion.`
    );

    try {
      let {
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl,
      } = req.body;

      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      if (
        !title_en?.trim() ||
        !content_en?.trim() ||
        !category?.trim() ||
        !author?.trim()
      ) {
        return next(
          new ErrorHandler(
            "Suggestion for new article requires at least English Title, English Content, Category, and Author.",
            400
          )
        );
      }

      const proposedDataPayload = {
        title_en,
        content_en,
        excerpt_en,
        title_rus,
        content_rus,
        excerpt_rus,
        title_mng,
        content_mng,
        excerpt_mng,
        category,
        author,
        imageUrl: imageUrl || null,
      };

      const newSuggestion = await SuggestedEdit.create({
        articleId: null,
        moderatorId: moderatorId,
        proposedData: proposedDataPayload,
        status: "pending",
      });

      console.log(
        `[${timestamp}] NEW Article Suggestion created (ID: ${newSuggestion.id}) by User ${moderatorId}.`
      );
      res.status(201).json({
        message:
          "New article suggestion submitted successfully and is pending review.",
        suggestionId: newSuggestion.id,
      });
    } catch (error) {
      console.error(
        `[${timestamp}] POST /api/admin/articles/suggest-new - Error:`,
        error
      );
      next(error);
    }
  }
);

// --- Admin Suggestion Management Routes ---

// GET /api/admin/suggestions (Admin view of ALL suggestions, filtered by status)
router.get(
  "/suggestions",
  authenticateToken,
  isAdmin,
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Invalid status filter."),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] GET /api/admin/suggestions (Admin All) - Query:`,
      req.query
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] GET /suggestions - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid query parameters", 400, errors.array())
      );
    }

    try {
      const filter = {};
      filter.status = req.query.status || "pending";
      console.log(
        `[${timestamp}] GET /suggestions (Admin All) - Fetching suggestions filter:`,
        filter
      );

      const suggestions = await SuggestedEdit.findAll({
        where: filter,
        include: [
          {
            model: Article,
            as: "article",
            attributes: ["id", "title_en"],
            required: false,
          },
          { model: User, as: "moderator", attributes: ["id", "username"] },
        ],
        attributes: [
          "id",
          "status",
          "createdAt",
          "updatedAt",
          "articleId",
          "moderatorId",
          "proposedData",
        ],
        order: [["createdAt", "ASC"]],
      });

      console.log(
        `[${timestamp}] GET /suggestions (Admin All) - Found ${suggestions.length} suggestions.`
      );
      const results = suggestions.map((s) => {
        const plainS = s.get({ plain: true });
        let result = { ...plainS };
        if (!result.articleId && result.proposedData?.title_en) {
          result.proposedTitle = result.proposedData.title_en;
        }
        delete result.proposedData;
        return result;
      });
      res.json(results);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /suggestions (Admin All) - Error listing suggestions:`,
        error
      );
      next(error);
    }
  }
);

// GET /api/admin/suggestions/my (Moderator's own suggestions)
router.get("/suggestions/my", authenticateToken, async (req, res, next) => {
  const timestamp = new Date().toISOString();
  const userId = req.user.userId;
  console.log(
    `[${timestamp}] GET /api/admin/suggestions/my - User ${userId} fetching own suggestions.`
  );

  try {
    const suggestions = await SuggestedEdit.findAll({
      where: { moderatorId: userId },
      include: [
        {
          model: Article,
          as: "article",
          attributes: ["id", "title_en"],
          required: false,
        },
      ],
      attributes: [
        "id",
        "status",
        "createdAt",
        "updatedAt",
        "articleId",
        "proposedData",
        "adminComments",
      ],
      order: [["updatedAt", "DESC"]],
    });

    console.log(
      `[${timestamp}] GET /suggestions/my - Found ${suggestions.length} suggestions for user ${userId}.`
    );
    const results = suggestions.map((s) => {
      const plainS = s.get({ plain: true });
      if (!plainS.articleId && plainS.proposedData?.title_en) {
        plainS.proposedTitle = plainS.proposedData.title_en;
      }
      return plainS;
    });
    res.json(results);
  } catch (error) {
    console.error(
      `[${timestamp}] GET /suggestions/my - Error fetching suggestions for user ${userId}:`,
      error
    );
    next(error);
  }
});

// GET /api/admin/articles/:id (Fetch FULL article details for Admin Edit)
router.get(
  "/articles/:id", // Route path within admin router
  authenticateToken,
  isModeratorOrAdmin, // Allow mods too if they use this for suggest-edit prepopulation
  validateArticleIdParam, // Validate the ID
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const articleId = req.params.id; // Get validated ID
    console.log(
      `[${timestamp}] GET /api/admin/articles/${articleId} (Admin Fetch) requested by User ${req.user.userId}`
    );

    try {
      const article = await Article.findByPk(articleId, {
        // No 'where' clause needed for status, fetch regardless
        // Fetch all fields needed for the edit form
        attributes: [
          "id",
          "category",
          "author",
          "imageUrl",
          "createdAt",
          "updatedAt",
          "views",
          "status", // Include status
          "title_en",
          "content_en",
          "excerpt_en",
          "title_rus",
          "content_rus",
          "excerpt_rus",
          "title_mng",
          "content_mng",
          "excerpt_mng",
        ],
      });

      if (!article) {
        console.warn(
          `[${timestamp}] GET /api/admin/articles/${articleId} - Article not found.`
        );
        return next(new ErrorHandler("Article not found", 404));
      }

      console.log(
        `[${timestamp}] GET /api/admin/articles/${articleId} - Article found, sending full details.`
      );
      res.json(article); // Send the full article object with all raw fields
    } catch (error) {
      console.error(
        `[${timestamp}] GET /api/admin/articles/${articleId} - Error fetching details:`,
        error
      );
      next(error);
    }
  }
);

// POST /api/admin/suggestions/:suggestionId/approve (Admin action)
router.post(
  "/suggestions/:suggestionId/approve",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const suggestionId = req.params.suggestionId;
    const adminUserId = req.user.userId;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] POST /suggestions/${suggestionId}/approve - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid suggestion ID", 400, errors.array())
      );
    }
    console.log(
      `[${timestamp}] POST /suggestions/${suggestionId}/approve - Admin ${adminUserId} attempting approval.`
    );

    let suggestion;
    try {
      suggestion = await SuggestedEdit.findByPk(suggestionId);
      if (!suggestion)
        return next(new ErrorHandler("Suggestion not found", 404));
      if (suggestion.status !== "pending")
        return next(
          new ErrorHandler(`Suggestion is already ${suggestion.status}`, 400)
        );
    } catch (findError) {
      console.error(
        `[${timestamp}] Approve Error - Failed to find suggestion ${suggestionId}:`,
        findError
      );
      return next(findError);
    }

    let transaction;
    try {
      transaction = await sequelize.transaction();
      const proposedData = suggestion.proposedData;
      let articleId = suggestion.articleId;
      let article;
      let action = "updated";

      if (articleId) {
        console.log(
          `[${timestamp}] Approving EDIT suggestion for Article ${articleId}`
        );
        article = await Article.findByPk(articleId, {
          transaction,
          lock: true,
        });
        if (!article) {
          await transaction.rollback();
          console.warn(
            `[${timestamp}] Approve Error - Original article ${articleId} missing for suggestion ${suggestionId}.`
          );
          return next(
            new ErrorHandler(
              "Cannot approve edit: Original article seems to be missing.",
              404
            )
          );
        }
        await article.update(proposedData, { transaction });
      } else {
        action = "created";
        console.log(
          `[${timestamp}] Approving NEW article suggestion from suggestion ${suggestionId}`
        );
        const newArticleData = {
          ...proposedData,
          status: "published",
          views: 0,
        };
        article = await Article.create(newArticleData, { transaction });
        articleId = article.id;
        console.log(
          `[${timestamp}] New article ${articleId} created from suggestion ${suggestionId}.`
        );
        suggestion.articleId = articleId;
      }

      suggestion.status = "approved";
      await suggestion.save({ transaction });
      await transaction.commit();

      console.log(
        `[${timestamp}] Suggestion ${suggestionId} approved by Admin ${adminUserId}. Article ${articleId} ${action}.`
      );
      res.json({
        message: `Suggestion approved. Article ${articleId} ${action} successfully.`,
        articleId: articleId,
        suggestionId: suggestionId,
      });
    } catch (error) {
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
          console.log(
            `[${timestamp}] Transaction rolled back for suggestion ${suggestionId} approval due to error.`
          );
        } catch (rollbackError) {
          console.error(
            `[${timestamp}] Error rolling back transaction for suggestion ${suggestionId}:`,
            rollbackError
          );
        }
      }
      console.error(
        `[${timestamp}] POST /suggestions/${suggestionId}/approve - Error during transaction:`,
        error
      );
      next(error);
    }
  }
);

// POST /api/admin/suggestions/:suggestionId/reject (Admin action)
router.post(
  "/suggestions/:suggestionId/reject",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(),
  body("adminComments").optional().trim().isLength({ max: 500 }).escape(),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const suggestionId = req.params.suggestionId;
    const adminUserId = req.user.userId;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] POST /suggestions/${suggestionId}/reject - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler(
          "Invalid suggestion ID or comment format",
          400,
          errors.array()
        )
      );
    }
    console.log(
      `[${timestamp}] POST /suggestions/${suggestionId}/reject - Admin ${adminUserId} attempting rejection.`
    );

    try {
      const suggestion = await SuggestedEdit.findByPk(suggestionId);
      if (!suggestion)
        return next(new ErrorHandler("Suggestion not found", 404));
      if (suggestion.status !== "pending")
        return next(
          new ErrorHandler(`Suggestion is already ${suggestion.status}`, 400)
        );

      suggestion.status = "rejected";
      suggestion.adminComments = req.body.adminComments || null;
      await suggestion.save();

      console.log(
        `[${timestamp}] Suggestion ${suggestionId} rejected by Admin ${adminUserId}.`
      );
      res.json({ message: "Suggestion rejected successfully." });
    } catch (error) {
      console.error(
        `[${timestamp}] POST /suggestions/${suggestionId}/reject - Error:`,
        error
      );
      next(error);
    }
  }
);

// GET /api/admin/suggestions/:suggestionId (Admin view details of a specific suggestion)
router.get(
  "/suggestions/:suggestionId",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const suggestionId = req.params.suggestionId;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] GET /suggestions/${suggestionId} - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid suggestion ID", 400, errors.array())
      );
    }
    console.log(
      `[${timestamp}] GET /suggestions/${suggestionId} - Admin ${req.user.userId} fetching details.`
    );

    try {
      const suggestion = await SuggestedEdit.findByPk(suggestionId, {
        include: [
          {
            model: Article,
            as: "article",
            attributes: ["id", "title_en"],
            required: false,
          },
          {
            model: User,
            as: "moderator",
            attributes: ["id", "username"],
            required: false,
          },
        ],
      });

      if (!suggestion)
        return next(new ErrorHandler("Suggestion not found", 404));

      console.log(
        `[${timestamp}] GET /suggestions/${suggestionId} - Suggestion found. Sending details.`
      );
      res.json(suggestion);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /suggestions/${suggestionId} - Error fetching details:`,
        error
      );
      next(error);
    }
  }
);

module.exports = router;
