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
const { Op } = require("sequelize");

const authenticateToken = require("../middleware/auth");
const ErrorHandler = require("../utils/errorHandler");
const generateTemporaryPassword = require("../utils/passwordGenerator");

// --- Helper function to generate JWT ---
function generateAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined!");
  }
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: "15m" }
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
    .isLength({ min: 128, max: 128 })
    .withMessage("Invalid refresh token format"),
];
const validateArticleBody = [
  body("title_en")
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
  ]),
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "style", "width", "height"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["data", "http", "https"] },
};

// --- Route Handlers ---

// POST /api/admin/login
router.post("/login", validateLoginBody, async (req, res, next) => {
  /* ... implementation ... */ const errors = validationResult(req);
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
    const match = await bcrypt.compare(password, user.password);
    console.log(`[Login Server] bcrypt.compare result (match): ${match}`);
    if (!match) {
      console.log(
        `[Login Server] Password comparison failed for user: ${username}`
      );
      return next(new ErrorHandler("Invalid credentials", 401));
    }
    console.log(`[Login Server] Password matches for user: ${username}`);
    if (user.needsPasswordChange) {
      console.log(`[Login Server] User ${username} requires password change.`);
      const changePasswordToken = jwt.sign(
        { userId: user.id, purpose: "force-change-password" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );
      return res
        .status(400)
        .json({
          message: "Password change required.",
          needsPasswordChange: true,
          changePasswordToken: changePasswordToken,
        });
    }
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
    next(err);
  }
});
// POST /api/admin/refresh
router.post("/refresh", validateRefreshTokenBody, async (req, res, next) => {
  /* ... implementation ... */ const errors = validationResult(req);
  if (!errors.isEmpty())
    return next(
      new ErrorHandler("Invalid refresh token provided", 400, errors.array())
    );
  try {
    const { refreshToken: e } = req.body;
    const t = await User.findOne({ where: { refreshToken: e } });
    if (!t) return next(new ErrorHandler("Invalid refresh token", 403));
    if (t.needsPasswordChange)
      return (
        console.warn(
          `Refresh attempt by user ${t.username} who needs password change.`
        ),
        next(
          new ErrorHandler(
            "Password change required before refreshing token",
            403
          )
        )
      );
    const o = generateAccessToken(t);
    res.json({ accessToken: o });
  } catch (e) {
    console.error("Refresh Token Error:", e);
    next(e);
  }
});
// GET /api/admin/me
router.get("/me", authenticateToken, async (req, res, next) => {
  /* ... implementation ... */ try {
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
  } catch (e) {
    console.error("[ADMIN ME] Error fetching user info:", e);
    next(e);
  }
});
// GET /api/admin/users
router.get(
  "/users",
  authenticateToken,
  isAdmin,
  query("role").optional().isIn(["admin", "moderator"]),
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    console.log(`[${t}] GET /api/admin/users - Query:`, req.query);
    try {
      const e = {};
      req.query.role && (e.role = req.query.role);
      console.log(`[${t}] GET /api/admin/users - Fetching filter:`, e);
      const o = await User.findAll({
        where: e,
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
      console.log(`[${t}] GET /api/admin/users - Found ${o.length} users.`);
      res.json(o);
    } catch (e) {
      console.error(`[${t}] GET /api/admin/users - Error:`, e);
      next(e);
    }
  }
);
// POST /api/admin/users
router.post(
  "/users",
  authenticateToken,
  isAdmin,
  validateModeratorCreation,
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    console.log(`[${t}] POST /api/admin/users - Body:`, req.body);
    try {
      const { username: e, email: o } = req.body;
      const s = generateTemporaryPassword();
      "production" !== process.env.NODE_ENV
        ? console.log(`Temp password for ${e}: ${s}`)
        : console.log(`Generated temp password for ${e}`);
      const r = await User.create({
        username: e,
        email: o,
        password: s,
        role: "moderator",
        needsPasswordChange: !0,
      });
      console.log(`[${t}] POST /api/admin/users - Moderator created:`, {
        id: r.id,
        username: r.username,
      });
      res
        .status(201)
        .json({
          message: "Moderator created successfully.",
          userId: r.id,
          username: r.username,
          email: r.email,
          temporaryPassword: s,
        });
    } catch (t) {
      console.error(`[${t}] POST /api/admin/users - Error:`, t);
      if ("SequelizeUniqueConstraintError" === t.name)
        return next(new ErrorHandler("Username or email already exists.", 409));
      next(t);
    }
  }
);
// POST /api/admin/force-change-password
router.post(
  "/force-change-password",
  validateForcePasswordChange,
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    console.log(`[${t}] POST /api/admin/force-change-password attempt.`);
    const e = validationResult(req);
    if (!e.isEmpty())
      return (
        console.warn(`[${t}] Force Change PW Validation Errors:`, e.array()),
        next(new ErrorHandler("Validation Error", 400, e.array()))
      );
    try {
      const { changePasswordToken: e, newPassword: o } = req.body;
      let s;
      try {
        s = jwt.verify(e, process.env.JWT_SECRET);
        if ("force-change-password" !== s.purpose)
          throw new Error("Invalid token purpose");
      } catch (e) {
        return (
          console.warn(
            `[${t}] Force Change PW - Invalid/Expired Token:`,
            e.message
          ),
          next(
            new ErrorHandler("Invalid or expired password change token.", 401)
          )
        );
      }
      const r = s.userId;
      const a = await User.findByPk(r);
      if (!a)
        return (
          console.error(`[${t}] Force Change PW - User ${r} not found!`),
          next(new ErrorHandler("User not found.", 404))
        );
      if (!a.needsPasswordChange)
        return (
          console.warn(
            `[${t}] Force Change PW - User ${r} no longer needs change.`
          ),
          res
            .status(400)
            .json({ message: "Password has already been changed." })
        );
      a.password = o;
      a.needsPasswordChange = !1;
      await a.save();
      console.log(`[${t}] Force Change PW - Success for user ${r}.`);
      res
        .status(200)
        .json({
          message:
            "Password successfully changed. Please log in with your new password.",
        });
    } catch (e) {
      console.error(`[${t}] Force Change PW - Error:`, e);
      next(e);
    }
  }
);

// --- Article Management Routes ---
router.post(
  "/articles",
  authenticateToken,
  isAdmin,
  validateArticleBody,
  async (req, res, next) => {
    /* ... implementation ... */ const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
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
      });
      console.log("Article created:", newArticle.id);
      res.status(201).json(newArticle);
    } catch (err) {
      console.error("Create Article Error:", err);
      next(err);
    }
  }
);
router.put(
  "/articles/:id",
  authenticateToken,
  isAdmin,
  validateArticleIdParam,
  validateArticleBody,
  async (req, res, next) => {
    /* ... implementation ... */ const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new ErrorHandler("Validation Error", 400, errors.array()));
    try {
      const articleId = req.params.id;
      const article = await Article.findByPk(articleId);
      if (!article) return next(new ErrorHandler("Article not found", 404));
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
      console.log("Article updated:", articleId);
      res.json(article);
    } catch (err) {
      console.error(`Update Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);
router.delete(
  "/articles/:id",
  authenticateToken,
  isAdmin,
  validateArticleIdParam,
  async (req, res, next) => {
    /* ... implementation ... */ const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
    try {
      const articleId = req.params.id;
      const article = await Article.findByPk(articleId);
      if (!article) return next(new ErrorHandler("Article not found", 404));
      await article.destroy();
      console.log("Article deleted:", articleId);
      res.status(204).send();
    } catch (err) {
      console.error(`Delete Article Error (ID: ${req.params.id}):`, err);
      next(err);
    }
  }
);

// --- Suggestion Routes ---
router.post(
  "/articles/:id/suggest",
  authenticateToken,
  isModeratorOrAdmin,
  validateArticleIdParam,
  validateArticleBody,
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    const e = req.params.id;
    const n = req.user.userId;
    const o = validationResult(req);
    if (!o.isEmpty())
      return (
        console.warn(`[${t}] Suggest Edit Validation Errors:`, o.array()),
        next(new ErrorHandler("Validation Error", 400, o.array()))
      );
    console.log(
      `[${t}] POST /api/admin/articles/${e}/suggest - User ${n} submitting suggestion.`
    );
    try {
      const o = await Article.findByPk(e, { attributes: ["id", "status"] });
      if (!o)
        return (
          console.warn(`[${t}] Suggest Edit - Target article ${e} not found.`),
          next(new ErrorHandler("Article not found", 404))
        );
      let {
        title_en: s,
        content_en: r,
        excerpt_en: a,
        title_rus: l,
        content_rus: i,
        excerpt_rus: c,
        title_mng: d,
        content_mng: u,
        excerpt_mng: m,
        category: g,
        author: h,
        imageUrl: p,
      } = req.body;
      r = sanitizeHtml(r || "", sanitizeOptions);
      i = sanitizeHtml(i || "", sanitizeOptions);
      u = sanitizeHtml(u || "", sanitizeOptions);
      const y = {
        title_en: s,
        content_en: r,
        excerpt_en: a,
        title_rus: l,
        content_rus: i,
        excerpt_rus: c,
        title_mng: d,
        content_mng: u,
        excerpt_mng: m,
        category: g,
        author: h,
        imageUrl: p || null,
      };
      const f = await SuggestedEdit.create({
        articleId: e,
        moderatorId: n,
        proposedData: y,
        status: "pending",
      });
      console.log(
        `[${t}] Suggestion created (ID: ${f.id}) for Article ${e} by User ${n}.`
      );
      res
        .status(201)
        .json({
          message: "Suggestion submitted successfully and is pending review.",
          suggestionId: f.id,
        });
    } catch (o) {
      console.error(`[${t}] POST /api/admin/articles/${e}/suggest - Error:`, o);
      next(o);
    }
  }
);
router.post(
  "/articles/suggest-new",
  authenticateToken,
  isModeratorOrAdmin,
  validateArticleBody,
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    const n = req.user.userId;
    const o = validationResult(req);
    if (!o.isEmpty())
      return (
        console.warn(`[${t}] Suggest New Validation Errors:`, o.array()),
        next(new ErrorHandler("Validation Error", 400, o.array()))
      );
    console.log(
      `[${t}] POST /api/admin/articles/suggest-new - User ${n} submitting NEW suggestion.`
    );
    try {
      let {
        title_en: s,
        content_en: r,
        excerpt_en: a,
        title_rus: l,
        content_rus: i,
        excerpt_rus: c,
        title_mng: d,
        content_mng: u,
        excerpt_mng: m,
        category: g,
        author: h,
        imageUrl: p,
      } = req.body;
      r = sanitizeHtml(r || "", sanitizeOptions);
      i = sanitizeHtml(i || "", sanitizeOptions);
      u = sanitizeHtml(u || "", sanitizeOptions);
      const y = {
        title_en: s,
        content_en: r,
        excerpt_en: a,
        title_rus: l,
        content_rus: i,
        excerpt_rus: c,
        title_mng: d,
        content_mng: u,
        excerpt_mng: m,
        category: g,
        author: h,
        imageUrl: p || null,
      };
      const f = await SuggestedEdit.create({
        articleId: null,
        moderatorId: n,
        proposedData: y,
        status: "pending",
      });
      console.log(
        `[${t}] NEW Article Suggestion created (ID: ${f.id}) by User ${n}.`
      );
      res
        .status(201)
        .json({
          message:
            "New article suggestion submitted successfully and is pending review.",
          suggestionId: f.id,
        });
    } catch (o) {
      console.error(`[${t}] POST /api/admin/articles/suggest-new - Error:`, o);
      next(o);
    }
  }
);

// --- Admin Suggestion Management Routes ---
router.get(
  "/suggestions",
  authenticateToken,
  isAdmin,
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Invalid status filter."),
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    console.log(`[${t}] GET /api/admin/suggestions - Query:`, req.query);
    const e = validationResult(req);
    if (!e.isEmpty())
      return (
        console.warn(`[${t}] GET /suggestions - Validation Errors:`, e.array()),
        next(new ErrorHandler("Invalid query parameters", 400, e.array()))
      );
    try {
      const e = {};
      req.query.status ? (e.status = req.query.status) : (e.status = "pending");
      console.log(`[${t}] GET /suggestions - Fetching suggestions filter:`, e);
      const o = await SuggestedEdit.findAll({
        where: e,
        include: [
          {
            model: Article,
            as: "article",
            attributes: ["id", "title_en"],
            required: !1,
          },
          { model: User, as: "moderator", attributes: ["id", "username"] },
        ],
        attributes: ["id", "status", "createdAt", "updatedAt", "articleId"],
        order: [["createdAt", "ASC"]],
      });
      console.log(`[${t}] GET /suggestions - Found ${o.length} suggestions.`);
      res.json(o);
    } catch (e) {
      console.error(`[${t}] GET /suggestions - Error listing suggestions:`, e);
      next(e);
    }
  }
);
router.post(
  "/suggestions/:suggestionId/approve",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(),
  async (req, res, next) => {
    const t = new Date().toISOString();
    const e = req.params.suggestionId;
    const n = req.user.userId;
    const o = validationResult(req);
    if (!o.isEmpty())
      return (
        console.warn(
          `[${t}] POST /suggestions/${e}/approve - Validation Errors:`,
          o.array()
        ),
        next(new ErrorHandler("Invalid suggestion ID", 400, o.array()))
      );
    console.log(
      `[${t}] POST /suggestions/${e}/approve - Admin ${n} attempting approval.`
    );
    let suggestion;
    try {
      suggestion = await SuggestedEdit.findByPk(e);
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
        `[${t}] Approve Error - Failed to find suggestion ${e}:`,
        findError
      );
      return next(findError);
    }
    const transaction = await sequelize.transaction();
    try {
      const proposedData =
        typeof suggestion.proposedData === "string"
          ? JSON.parse(suggestion.proposedData)
          : suggestion.proposedData;
      let articleId = suggestion.articleId;
      let article;
      if (articleId) {
        console.log(
          `[${t}] Approving EDIT suggestion for Article ${articleId}`
        );
        article = await Article.findByPk(articleId, {
          transaction,
          lock: true,
        });
        if (!article) {
          await transaction.rollback();
          return next(
            new ErrorHandler(
              "Cannot approve edit: Original article missing.",
              500
            )
          );
        }
        await article.update(proposedData, { transaction });
      } else {
        console.log(
          `[${t}] Approving NEW article suggestion from suggestion ${e}`
        );
        const newArticleData = {
          ...proposedData,
          status: "published",
          views: 0,
        };
        article = await Article.create(newArticleData, { transaction });
        articleId = article.id;
        console.log(
          `[${t}] New article ${articleId} created from suggestion ${e}.`
        );
        suggestion.articleId = articleId;
      }
      suggestion.status = "approved";
      await suggestion.save({ transaction: transaction });
      await transaction.commit();
      console.log(
        `[${t}] Suggestion ${e} approved by Admin ${req.user.userId}. Article ${articleId} created/updated.`
      );
      res.json({
        message: `Suggestion approved. Article ${articleId} ${
          suggestion.articleId ? "updated" : "created"
        } successfully.`,
      });
    } catch (error) {
      if (
        transaction &&
        transaction.finished !== "commit" &&
        transaction.finished !== "rollback"
      ) {
        await transaction.rollback();
        console.log(
          `[${t}] Transaction rolled back for suggestion ${e} approval.`
        );
      }
      console.error(
        `[${t}] POST /suggestions/${e}/approve - Error during transaction:`,
        error
      );
      next(error);
    }
  }
);
router.post(
  "/suggestions/:suggestionId/reject",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(),
  body("adminComments").optional().trim().isLength({ max: 500 }).escape(),
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    const e = req.params.suggestionId;
    const n = req.user.userId;
    const o = validationResult(req);
    if (!o.isEmpty())
      return (
        console.warn(
          `[${t}] POST /suggestions/${e}/reject - Validation Errors:`,
          o.array()
        ),
        next(
          new ErrorHandler("Invalid suggestion ID or comment", 400, o.array())
        )
      );
    console.log(
      `[${t}] POST /suggestions/${e}/reject - Admin ${n} attempting rejection.`
    );
    try {
      const n = await SuggestedEdit.findByPk(e);
      if (!n) return next(new ErrorHandler("Suggestion not found", 404));
      if ("pending" !== n.status)
        return next(new ErrorHandler(`Suggestion is already ${n.status}`, 400));
      n.status = "rejected";
      req.body.adminComments && (n.adminComments = req.body.adminComments);
      await n.save();
      console.log(
        `[${t}] Suggestion ${e} rejected by Admin ${req.user.userId}.`
      );
      res.json({ message: "Suggestion rejected successfully." });
    } catch (e) {
      console.error(`[${t}] POST /suggestions/${e}/reject - Error:`, e);
      next(e);
    }
  }
);
router.get(
  "/suggestions/:suggestionId",
  authenticateToken,
  isAdmin,
  param("suggestionId").isInt({ min: 1 }).toInt(),
  async (req, res, next) => {
    /* ... implementation ... */ const t = new Date().toISOString();
    const e = req.params.suggestionId;
    const n = validationResult(req);
    if (!n.isEmpty())
      return (
        console.warn(
          `[${t}] GET /suggestions/${e} - Validation Errors:`,
          n.array()
        ),
        next(new ErrorHandler("Invalid suggestion ID", 400, n.array()))
      );
    console.log(
      `[${t}] GET /suggestions/${e} - Admin ${req.user.userId} fetching details.`
    );
    try {
      const n = await SuggestedEdit.findByPk(e, {
        include: [
          { model: Article, as: "article", attributes: ["id", "title_en"] },
          { model: User, as: "moderator", attributes: ["id", "username"] },
        ],
      });
      if (!n) return next(new ErrorHandler("Suggestion not found", 404));
      console.log(
        `[${t}] GET /suggestions/${e} - Suggestion found. Sending details.`
      );
      res.json(n);
    } catch (e) {
      console.error(
        `[${t}] GET /suggestions/${e} - Error fetching details:`,
        e
      );
      next(e);
    }
  }
);

module.exports = router;
