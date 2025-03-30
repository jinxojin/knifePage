// server/routes/articles.js
const express = require("express");
const router = express.Router();
const { query, param, validationResult } = require("express-validator");
const { Op } = require("sequelize");

const { Article } = require("../models"); // Assuming models are exported correctly
const ErrorHandler = require("../utils/errorHandler");

// --- Validation Middleware Definitions ---
const supportedLangs = ["en", "rus", "mng"];

const validateGetArticlesQuery = [
  query("category")
    .optional()
    .custom((value) => {
      // Allow comma-separated categories
      if (!value) return true;
      const categories = value.split(",");
      const validCategories = ["news", "competition", "blog"];
      return categories.every((cat) => validCategories.includes(cat.trim()));
    })
    .withMessage(
      "Invalid category specified. Allowed: news, competition, blog (comma-separated)"
    ),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 }) // Max limit for safety
    .toInt()
    .withMessage("Limit must be a positive integer (max 50)"),
  query("page") // Added page validation
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Page must be a positive integer"),
  query("lang") // Added language validation
    .optional()
    .isIn(supportedLangs)
    .withMessage(
      `Invalid language code. Supported: ${supportedLangs.join(", ")}`
    ),
];

const validateCategoryParam = [
  param("category")
    .isIn(["news", "competition", "blog"])
    .withMessage("Invalid category specified"),
];

const validateArticleIdParam = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Article ID must be a positive integer")
    .toInt(),
];

// Helper to get language attributes with aliases
const getLangAttributes = (lang = "en") => {
  const validLang = supportedLangs.includes(lang) ? lang : "en";
  return [
    [`title_${validLang}`, "title"],
    [`content_${validLang}`, "content"],
    [`excerpt_${validLang}`, "excerpt"],
  ];
};

// Common attributes needed
const commonAttributes = [
  "id",
  "category",
  "author",
  "imageUrl",
  "createdAt",
  "updatedAt",
  "views",
  "status",
];

// --- Routes ---

// GET articles by category with limit (Keep Original Handler)
router.get(
  "/category/:category",
  validateCategoryParam,
  query("limit").optional().isInt({ min: 1, max: 10 }).toInt(),
  query("lang").optional().isIn(supportedLangs),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] Entering GET /api/articles/category/${req.params.category} handler chain for query:`,
      req.query
    );
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] GET /api/articles/category/${req.params.category} - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid request parameters", 400, errors.array())
      );
    }
    try {
      const { category } = req.params;
      const limit = req.query.limit || 1;
      const lang = req.query.lang || "en";
      const langAttributes = getLangAttributes(lang);
      console.log(
        `[${timestamp}] GET /api/articles/category/${category} - Executing DB query with options:`,
        {
          where: { category, status: "published" },
          limit,
          order: [["createdAt", "DESC"]],
        }
      );
      const articles = await Article.findAll({
        where: { category: category, status: "published" },
        order: [["createdAt", "DESC"]],
        limit: limit,
        attributes: [
          ...commonAttributes.filter(
            (attr) => !["content", "status", "updatedAt"].includes(attr)
          ),
          ...langAttributes.filter((attr) => attr[1] !== "content"),
        ],
      });
      console.log(
        `[${timestamp}] GET /api/articles/category/${category} - DB Query Result: Found ${articles.length} articles.`
      );
      console.log(
        `[${timestamp}] GET /api/articles/category/${category} - Sending success response.`
      );
      res.json(articles);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /api/articles/category/${req.params.category} - ERROR caught in route handler:`,
        error
      );
      next(
        new ErrorHandler(
          error.message || "Failed to fetch articles.",
          error.statusCode || 500
        )
      );
    }
  }
);

// GET /api/articles/all - Simple list (Keep Original Handler)
router.get(
  "/all",
  query("lang").optional().isIn(supportedLangs),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] Entering GET /api/articles/all handler chain for query:`,
      req.query
    );
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] GET /api/articles/all - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid query parameters", 400, errors.array())
      );
    }
    try {
      const lang = req.query.lang || "en";
      const langAttributes = getLangAttributes(lang);
      console.log(
        `[${timestamp}] GET /api/articles/all - Executing DB query...`
      );
      const articles = await Article.findAll({
        attributes: [
          ...commonAttributes.filter((attr) => attr !== "content"),
          ...langAttributes.filter((attr) => attr[1] !== "content"),
        ],
        order: [["createdAt", "DESC"]],
      });
      console.log(
        `[${timestamp}] GET /api/articles/all - DB Query Result: Found ${articles.length} articles.`
      );
      console.log(
        `[${timestamp}] GET /api/articles/all - Sending success response.`
      );
      res.json(articles);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /api/articles/all - ERROR caught in route handler:`,
        error
      );
      next(
        new ErrorHandler(
          error.message || "Server error while fetching articles.",
          error.statusCode || 500
        )
      );
    }
  }
);

// ========== RESTORED ORIGINAL HANDLER FOR GET /api/articles ==========
router.get(
  "/",
  // Logging middleware first
  (req, res, next) => {
    console.log(
      `[${new Date().toISOString()}] Entering GET /api/articles handler chain for query:`,
      req.query
    );
    next();
  },
  // *** Re-enable the validation middleware ***
  validateGetArticlesQuery,
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] GET /api/articles - Async Handler entered.`);

    // Check validation results *after* the middleware runs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] GET /api/articles - Validation Errors:`,
        errors.array()
      );
      // Pass error to global handler which will send JSON
      return next(
        new ErrorHandler("Invalid query parameters", 400, errors.array())
      );
    }

    try {
      // Proceed with original logic now that validation passed (or was bypassed if commented)
      const { category, limit: queryLimit, page: queryPage, lang } = req.query;
      const limit = queryLimit || 6; // Use validated or default limit
      const page = queryPage || 1; // Use validated or default page
      const offset = (page - 1) * limit;
      const currentLang = lang || "en"; // Use validated or default lang
      const langAttributes = getLangAttributes(currentLang);

      const whereClause = {
        status: "published",
      };

      if (category) {
        const categories = category
          .split(",")
          .map((cat) => cat.trim())
          .filter(Boolean);
        // Validation ensures categories are valid if provided
        if (categories.length > 0) {
          whereClause.category = { [Op.in]: categories };
        }
      }

      console.log(
        `[${timestamp}] GET /api/articles - Executing DB query with options:`,
        { where: whereClause, limit, offset, order: [["createdAt", "DESC"]] }
      );

      const { count, rows } = await Article.findAndCountAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        limit: limit,
        offset: offset,
        attributes: [
          ...commonAttributes.filter(
            (attr) => !["content", "status", "updatedAt"].includes(attr)
          ),
          ...langAttributes.filter((attr) => attr[1] !== "content"),
        ],
        distinct: true,
      });

      console.log(
        `[${timestamp}] GET /api/articles - DB Query Result: Found ${count} total, returning ${rows.length} articles for page ${page}.`
      );

      const responseData = {
        totalArticles: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        articles: rows,
      };

      console.log(
        `[${timestamp}] GET /api/articles - Sending success response.`
      );
      res.setHeader("Content-Type", "application/json"); // Ensure JSON header
      res.json(responseData);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /api/articles - ERROR caught in route handler:`,
        error
      );
      next(
        new ErrorHandler(
          error.message || "Server error while fetching articles.",
          error.statusCode || 500
        )
      );
    }
  }
);
// =================================================================

// GET /api/articles/:id (Fetch single article detail - Keep Original Handler)
router.get(
  "/:id",
  (req, res, next) => {
    console.log(
      `[${new Date().toISOString()}] Entering GET /api/articles/:id handler chain for ID: ${
        req.params.id
      }, query:`,
      req.query
    );
    next();
  },
  validateArticleIdParam,
  query("lang").optional().isIn(supportedLangs),
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] GET /api/articles/${req.params.id} - Async Handler entered.`
    );
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] GET /api/articles/${req.params.id} - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid Article ID or Language", 400, errors.array())
      );
    }
    try {
      const articleId = req.params.id;
      const lang = req.query.lang || "en";
      const langAttributes = getLangAttributes(lang);
      const attributesToFetch = [...commonAttributes, ...langAttributes];
      const publicAttributes = attributesToFetch.filter(
        (attr) => attr !== "status"
      );
      console.log(
        `[${timestamp}] GET /api/articles/${articleId} - Executing DB query...`
      );
      const article = await Article.findOne({
        where: { id: articleId, status: "published" },
        attributes: publicAttributes,
      });
      if (!article) {
        console.warn(
          `[${timestamp}] GET /api/articles/${articleId} - Article not found.`
        );
        return next(new ErrorHandler("Article Not Found", 404));
      }
      console.log(
        `[${timestamp}] GET /api/articles/${articleId} - Article found. Incrementing views...`
      );
      Article.increment("views", { where: { id: articleId } }).catch((err) => {
        console.error(
          `[${timestamp}] GET /api/articles/${articleId} - Failed to increment view count:`,
          err
        );
      });
      console.log(
        `[${timestamp}] GET /api/articles/${articleId} - Sending success response.`
      );
      res.setHeader("Content-Type", "application/json");
      res.json(article);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /api/articles/${req.params.id} - ERROR caught in route handler:`,
        error
      );
      next(error);
    }
  }
);

module.exports = router;
