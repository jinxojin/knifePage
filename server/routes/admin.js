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
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores")
    .custom(async (value) => {
      const user = await User.findOne({ where: { username: value } });
      if (user) {
        return Promise.reject("Username already in use");
      }
    }),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail()
    .custom(async (value) => {
      const user = await User.findOne({ where: { email: value } });
      if (user) {
        return Promise.reject("Email already in use");
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
    // Color/Background related inline styles might be needed if Quill outputs them
  ]),
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "style", "width", "height", "class"], // Added class
    span: ["style", "class"], // Allow style/class on span
    p: ["style", "class"], // Allow style/class on p
    div: ["style", "class"], // Allow style/class on div
    // Allow class globally
    "*": ["class"],
  },
  // Allow inline styles (use cautiously, ensure Quill config is restricted)
  allowedStyles: {
    "*": {
      // Allow basic text formatting styles
      "text-align": [/^left$/, /^center$/, /^right$/, /^justify$/],
      color: [
        /^#(?:[0-9a-fA-F]{3}){1,2}$/,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      "background-color": [
        /^#(?:[0-9a-fA-F]{3}){1,2}$/,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      // Potentially allow float/margin for images if needed, but be specific
      float: [/^left$/, /^right$/],
      margin: [/^\d+px$/],
      "margin-left": [/^\d+px$/],
      "margin-right": [/^\d+px$/],
      "margin-top": [/^\d+px$/],
      "margin-bottom": [/^\d+px$/],
    },
    // Add specific styles for other tags if necessary
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["data", "http", "https"] }, // Allow data URIs for images if needed
  // Allow classes matching Tailwind patterns (example, adjust as needed)
  // allowedClasses: {
  //   '*': [ /^ql-*/, /^text-*/, /^bg-*/, /^p-*/, /^m-*/, /^float-*/ ]
  // },
  // Self-closing tags
  selfClosing: ["img", "br", "hr"],
  // Disallow comments
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
      // Do not reveal if username exists or password failed
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
      // Generate a short-lived token specifically for the password change process
      const changePasswordToken = jwt.sign(
        { userId: user.id, purpose: "force-change-password" },
        process.env.JWT_SECRET, // Use the same JWT secret
        { expiresIn: "10m" } // Short expiry
      );
      // Send specific response indicating the need for change + the token
      return res.status(400).json({
        message: "Password change required. Please set a new password.",
        needsPasswordChange: true,
        changePasswordToken: changePasswordToken, // Send token needed for the change API
      });
    }

    // If password is valid and no change needed, issue tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString("hex");

    // Store refresh token (hashed ideally, but simple storage for now)
    user.refreshToken = refreshToken;
    user.needsPasswordChange = false; // Ensure flag is false
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
      return next(new ErrorHandler("Invalid refresh token", 403)); // Forbidden or Unauthorized? 403 is safer
    }

    // Optional: Check if the user associated with the refresh token still needs password change
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

    // Generate a new access token
    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    console.error("Refresh Token Error:", err);
    next(err);
  }
});

// GET /api/admin/me
router.get("/me", authenticateToken, async (req, res, next) => {
  // authenticateToken middleware sets req.user if token is valid
  try {
    if (!req.user || !req.user.userId) {
      // Should not happen if authenticateToken works, but good safety check
      return next(new ErrorHandler("User information not found in token", 401));
    }
    console.log(
      `[ADMIN ME] Sending user info for ${req.user.userId} from token:`,
      req.user
    );
    // Return the data embedded in the token (already verified)
    res.json({
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      // DO NOT send sensitive data like password hash or refresh token here
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
  query("role").optional().isIn(["admin", "moderator"]), // Validate optional role query
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
          // Select only necessary, non-sensitive fields
          "id",
          "username",
          "email",
          "role",
          "createdAt",
          "needsPasswordChange", // Include this flag
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
  validateModeratorCreation, // Apply validation middleware
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] POST /api/admin/users - Body:`, req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] Create User Validation Errors:`,
        errors.array()
      );
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const { username, email } = req.body;
      const temporaryPassword = generateTemporaryPassword(); // Generate temp password

      // Log temp password only in development for debugging
      if (process.env.NODE_ENV !== "production") {
        console.log(`Temp password for ${username}: ${temporaryPassword}`);
      } else {
        console.log(`Generated temp password for ${username}`);
      }

      // Create user with hashed password and flag set
      const newUser = await User.create({
        username,
        email,
        password: temporaryPassword, // Sequelize hook will hash this
        role: "moderator", // Explicitly set role
        needsPasswordChange: true, // Set flag to true
      });

      console.log(`[${timestamp}] POST /api/admin/users - Moderator created:`, {
        id: newUser.id,
        username: newUser.username,
      });

      // Respond with success and the temporary password
      res.status(201).json({
        message:
          "Moderator created successfully. They must change password on first login.",
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        temporaryPassword: temporaryPassword, // Send temp password back to admin
      });
    } catch (error) {
      console.error(`[${timestamp}] POST /api/admin/users - Error:`, error);
      // Handle specific Sequelize unique constraint errors
      if (error.name === "SequelizeUniqueConstraintError") {
        return next(new ErrorHandler("Username or email already exists.", 409)); // 409 Conflict
      }
      next(error);
    }
  }
);

// POST /api/admin/force-change-password
router.post(
  "/force-change-password",
  // No authenticateToken middleware needed here, relies on the special changePasswordToken
  validateForcePasswordChange, // Apply validation
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

      // Verify the JWT token
      let decodedToken;
      try {
        decodedToken = jwt.verify(changePasswordToken, process.env.JWT_SECRET);
        // Check if the token's purpose is correct
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

      // Check if the flag is still true (maybe they changed it via another way?)
      if (!user.needsPasswordChange) {
        console.warn(
          `[${timestamp}] Force Change PW - User ${userId} no longer needs change.`
        );
        // Don't treat as error, maybe just inform user? Or return success?
        return res
          .status(400)
          .json({ message: "Password has already been changed." });
      }

      // Update password (hook will hash) and reset the flag
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
      // Destructure validated data
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

      // Sanitize HTML content AFTER validation
      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      // Ensure required fields are not just whitespace after potential sanitization
      if (!title_en?.trim()) {
        // Check main title
        return next(new ErrorHandler("English title is required.", 400));
      }
      if (!content_en?.trim()) {
        // Check main content
        return next(new ErrorHandler("English content is required.", 400));
      }
      if (!category?.trim() || !author?.trim()) {
        return next(new ErrorHandler("Category and Author are required.", 400));
      }

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
        imageUrl: imageUrl || null, // Handle optional URL
        status: "published", // Default status for admin creation
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
  validateArticleIdParam, // Validate ID in URL
  validateArticleBody, // Validate body content
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    }

    try {
      const articleId = req.params.id; // Get ID from validated param
      const article = await Article.findByPk(articleId);

      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }

      // Destructure validated data
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

      // Sanitize HTML content AFTER validation
      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      // Ensure required fields are not just whitespace after potential sanitization
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

      // Update the article instance
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
        // status: 'published', // Keep status as is unless explicitly changed
      });

      console.log("Article updated by admin:", articleId);
      res.json(article); // Return the updated article
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
  validateArticleIdParam, // Validate ID
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // This validation targets the URL param, not the body
      return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
    }

    try {
      const articleId = req.params.id;
      const article = await Article.findByPk(articleId);

      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }

      await article.destroy(); // Perform the deletion
      console.log("Article deleted by admin:", articleId);
      res.status(204).send(); // Send No Content on successful deletion
    } catch (err) {
      console.error(`Delete Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

// --- Suggestion Routes (Moderator/Admin) ---

// POST /api/admin/articles/:id/suggest (Suggest Edit for Existing Article)
router.post(
  "/articles/:id/suggest",
  authenticateToken,
  isModeratorOrAdmin,
  validateArticleIdParam, // Validate ID in URL
  validateArticleBody, // Validate body content
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const articleIdToEdit = req.params.id; // From validated param
    const moderatorId = req.user.userId; // From authenticated token

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
      // Check if the target article exists
      const targetArticle = await Article.findByPk(articleIdToEdit, {
        attributes: ["id", "status"],
      });
      if (!targetArticle) {
        console.warn(
          `[${timestamp}] Suggest Edit - Target article ${articleIdToEdit} not found.`
        );
        return next(new ErrorHandler("Article to edit not found", 404));
      }

      // Destructure validated body data
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

      // Sanitize HTML content AFTER validation
      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      // Ensure required base fields are present in the suggestion
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

      // Prepare the data payload for the suggestion
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

      // Create the suggestion record
      const newSuggestion = await SuggestedEdit.create({
        articleId: articleIdToEdit, // Link to the existing article
        moderatorId: moderatorId,
        proposedData: proposedDataPayload, // Store the validated & sanitized data
        status: "pending", // Initial status
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
  validateArticleBody, // Validate body content
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const moderatorId = req.user.userId; // From authenticated token

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
      // Destructure validated body data
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

      // Sanitize HTML content AFTER validation
      content_en = sanitizeHtml(content_en || "", sanitizeOptions);
      content_rus = sanitizeHtml(content_rus || "", sanitizeOptions);
      content_mng = sanitizeHtml(content_mng || "", sanitizeOptions);

      // Ensure required base fields are present
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

      // Prepare the data payload for the suggestion
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

      // Create the suggestion record with articleId as NULL
      const newSuggestion = await SuggestedEdit.create({
        articleId: null, // Indicate this is a suggestion for a NEW article
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
  query("status") // Validate optional status query
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
      // Default to 'pending' if no status is provided
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
            as: "article", // Alias defined in models/index.js
            attributes: ["id", "title_en"], // Get original article ID and EN title if it exists
            required: false, // Use LEFT JOIN for new suggestions or deleted articles
          },
          {
            model: User,
            as: "moderator", // Alias defined in models/index.js
            attributes: ["id", "username"], // Get moderator's ID and username
          },
        ],
        // Select fields needed for the admin list view
        attributes: [
          "id",
          "status",
          "createdAt",
          "updatedAt",
          "articleId",
          "moderatorId",
          // Include proposedData only to extract title for new items below
          "proposedData",
        ],
        order: [["createdAt", "ASC"]], // Show oldest pending first
      });

      console.log(
        `[${timestamp}] GET /suggestions (Admin All) - Found ${suggestions.length} suggestions.`
      );

      // Add proposed title for new articles to the response, remove full proposed data
      const results = suggestions.map((s) => {
        const plainS = s.get({ plain: true });
        // Copy necessary fields
        let result = { ...plainS };
        if (!result.articleId && result.proposedData?.title_en) {
          result.proposedTitle = result.proposedData.title_en; // Add hint for UI
        }
        delete result.proposedData; // Remove full data from list response
        return result;
      });

      res.json(results); // Send the processed list
    } catch (error) {
      console.error(
        `[${timestamp}] GET /suggestions (Admin All) - Error listing suggestions:`,
        error
      );
      next(error);
    }
  }
);

// ++++++++++ GET /api/admin/suggestions/my (Moderator's own suggestions) ++++++++++
router.get(
  "/suggestions/my",
  authenticateToken, // Just need authentication
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const userId = req.user.userId; // Get user ID from verified token
    console.log(
      `[${timestamp}] GET /api/admin/suggestions/my - User ${userId} fetching own suggestions.`
    );

    try {
      const suggestions = await SuggestedEdit.findAll({
        where: {
          moderatorId: userId, // Filter by the logged-in user's ID
        },
        include: [
          {
            model: Article,
            as: "article",
            attributes: ["id", "title_en"], // Include original article title if it exists
            required: false, // Keep false for suggestions of new articles
          },
        ],
        // Include all necessary fields for the moderator's view
        attributes: [
          "id",
          "status",
          "createdAt",
          "updatedAt",
          "articleId",
          "proposedData", // Send full proposedData so mod can see what they proposed
          "adminComments", // Include admin comments for rejected items
        ],
        order: [["updatedAt", "DESC"]], // Order by most recently updated
      });

      console.log(
        `[${timestamp}] GET /suggestions/my - Found ${suggestions.length} suggestions for user ${userId}.`
      );

      // Process results to add proposed title hint for easier frontend display
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
  }
);
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// POST /api/admin/suggestions/:suggestionId/approve (Admin action)
router.post(
  "/suggestions/:suggestionId/approve",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(), // Validate param
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const suggestionId = req.params.suggestionId; // From validated param
    const adminUserId = req.user.userId; // Admin performing the action

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
    // Find the suggestion first, outside transaction
    try {
      suggestion = await SuggestedEdit.findByPk(suggestionId);
      if (!suggestion) {
        return next(new ErrorHandler("Suggestion not found", 404));
      }
      if (suggestion.status !== "pending") {
        return next(
          new ErrorHandler(`Suggestion is already ${suggestion.status}`, 400)
        );
      }
    } catch (findError) {
      console.error(
        `[${timestamp}] Approve Error - Failed to find suggestion ${suggestionId}:`,
        findError
      );
      return next(findError); // Pass error to global handler
    }

    // Start transaction
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // Parse proposedData safely (it's stored as JSONB)
      const proposedData = suggestion.proposedData; // Already an object from Sequelize

      let articleId = suggestion.articleId;
      let article;
      let action = "updated"; // Default action text

      if (articleId) {
        // --- Approving an EDIT to an existing article ---
        console.log(
          `[${timestamp}] Approving EDIT suggestion for Article ${articleId}`
        );
        article = await Article.findByPk(articleId, {
          transaction,
          lock: true,
        }); // Lock row during transaction

        if (!article) {
          // If original article deleted after suggestion was made
          await transaction.rollback(); // Rollback before sending error
          console.warn(
            `[${timestamp}] Approve Error - Original article ${articleId} missing for suggestion ${suggestionId}.`
          );
          return next(
            new ErrorHandler(
              "Cannot approve edit: Original article seems to be missing.",
              404
            )
          ); // Use 404 or 409?
        }

        // Update the existing article with proposed data
        await article.update(proposedData, { transaction });
      } else {
        // --- Approving a suggestion for a NEW article ---
        action = "created";
        console.log(
          `[${timestamp}] Approving NEW article suggestion from suggestion ${suggestionId}`
        );

        // Create a new article using the proposed data
        const newArticleData = {
          ...proposedData,
          status: "published", // New articles are published on approval
          views: 0,
        };
        article = await Article.create(newArticleData, { transaction });
        articleId = article.id; // Get the ID of the newly created article

        console.log(
          `[${timestamp}] New article ${articleId} created from suggestion ${suggestionId}.`
        );

        // Update the suggestion record to link it to the new article
        suggestion.articleId = articleId;
      }

      // Update the suggestion status to 'approved'
      suggestion.status = "approved";
      // Optional: Clear admin comments on approval?
      // suggestion.adminComments = null;
      await suggestion.save({ transaction });

      // Commit the transaction
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
      // Rollback transaction if it exists and hasn't finished
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
      next(error); // Pass error to global handler
    }
  }
);

// POST /api/admin/suggestions/:suggestionId/reject (Admin action)
router.post(
  "/suggestions/:suggestionId/reject",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(), // Validate param
  body("adminComments").optional().trim().isLength({ max: 500 }).escape(), // Validate optional comment
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const suggestionId = req.params.suggestionId; // From validated param
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

      if (!suggestion) {
        return next(new ErrorHandler("Suggestion not found", 404));
      }

      if (suggestion.status !== "pending") {
        // Allow re-rejecting? Or prevent action if already handled? Let's prevent.
        return next(
          new ErrorHandler(`Suggestion is already ${suggestion.status}`, 400)
        );
      }

      // Update status and add comment if provided
      suggestion.status = "rejected";
      if (req.body.adminComments) {
        suggestion.adminComments = req.body.adminComments; // Store the sanitized comment
      } else {
        suggestion.adminComments = null; // Clear comments if none provided
      }

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
  param("suggestionId").isInt({ min: 1 }).toInt(), // Validate param
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    const suggestionId = req.params.suggestionId; // From validated param

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
          // Include related data needed for display
          {
            model: Article,
            as: "article", // Original article (if it's an edit suggestion)
            attributes: ["id", "title_en"], // Basic info is enough
            required: false,
          },
          {
            model: User,
            as: "moderator", // User who submitted
            attributes: ["id", "username"],
            required: false, // Keep suggestions even if moderator is deleted? Maybe.
          },
        ],
        // No need to select specific attributes here, usually want all details
      });

      if (!suggestion) {
        return next(new ErrorHandler("Suggestion not found", 404));
      }

      console.log(
        `[${timestamp}] GET /suggestions/${suggestionId} - Suggestion found. Sending details.`
      );
      res.json(suggestion); // Send the full suggestion object with included data
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
