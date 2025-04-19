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

// --- Helper Functions & Constants ---

// Helper to get language attributes with aliases FOR PUBLIC LISTS (title, excerpt)
const getLangListAttributes = (lang = "en") => {
  const validLang = supportedLangs.includes(lang) ? lang : "en";
  return [
    [`title_${validLang}`, "title"],
    // [`content_${validLang}`, "content"], // Content not usually needed for lists
    [`excerpt_${validLang}`, "excerpt"],
  ];
};

// Helper to get language attributes with aliases FOR PUBLIC SINGLE VIEW (title, content)
const getLangSingleAttributes = (lang = "en") => {
  const validLang = supportedLangs.includes(lang) ? lang : "en";
  return [
    [`title_${validLang}`, "title"],
    [`content_${validLang}`, "content"], // Need full content here
    // [`excerpt_${validLang}`, "excerpt"], // Excerpt not needed for full view
  ];
};

// Common attributes needed for public LIST views (excluding content)
const commonListAttributes = [
  "id",
  "category",
  "author",
  "imageUrl",
  "createdAt",
  // "updatedAt", // Usually not needed for public lists
  "views",
  // "status", // Public routes only show published
];

// Common attributes needed for public SINGLE article views (excluding raw language fields)
const commonSingleAttributes = [
  "id",
  "category",
  "author",
  "imageUrl",
  "createdAt",
  // "updatedAt", // Usually not needed for public view
  "views",
  // "status", // Already filtered
];

// --- Routes ---

// GET articles by category with limit (for highlights)
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
      const langAttributes = getLangListAttributes(lang); // Use list attributes (title, excerpt)

      console.log(
        `[${timestamp}] GET /api/articles/category/${category} - Executing DB query...`
      );
      const articles = await Article.findAll({
        where: { category: category, status: "published" },
        order: [["createdAt", "DESC"]],
        limit: limit,
        attributes: [
          ...commonListAttributes, // Include common list fields
          ...langAttributes, // Include aliased title & excerpt
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
        `[${timestamp}] GET /api/articles/category/${req.params.category} - ERROR caught:`,
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

// GET /api/articles/all - Simple list (Admin Only - fetches all fields)
// NOTE: This is likely used ONLY by the admin panel now.
// If public pages need a simple "all" list, create a separate endpoint or use the main GET /
router.get(
  "/all",
  // Consider adding authenticateToken, isAdmin middleware if this is truly admin-only
  query("lang").optional().isIn(supportedLangs), // Lang might not be needed if fetching all raw fields
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] Entering GET /api/articles/all (Admin List) handler chain...`
    );
    // Removed language handling as admin likely needs all raw fields
    try {
      console.log(
        `[${timestamp}] GET /api/articles/all - Executing DB query...`
      );
      const articles = await Article.findAll({
        // Fetch ALL fields for admin panel display/editing
        attributes: [
          "id",
          "category",
          "author",
          "imageUrl",
          "createdAt",
          "updatedAt",
          "views",
          "status", // Include status for admin view
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
        `[${timestamp}] GET /api/articles/all - ERROR caught:`,
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

// GET /api/articles - Paginated list (Public facing)
router.get(
  "/",
  (req, res, next) => {
    /* ... logging middleware ... */ next();
  },
  validateGetArticlesQuery, // Use the validation middleware
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] GET /api/articles (Paginated Public) - Async Handler entered.`
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(
        `[${timestamp}] GET /api/articles - Validation Errors:`,
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid query parameters", 400, errors.array())
      );
    }

    try {
      const { category, limit: queryLimit, page: queryPage, lang } = req.query;
      const limit = queryLimit || 6;
      const page = queryPage || 1;
      const offset = (page - 1) * limit;
      const currentLang = lang || "en";
      const langAttributes = getLangListAttributes(currentLang); // Use LIST attributes (title, excerpt)

      const whereClause = {
        status: "published", // Only show published articles
      };

      if (category) {
        const categories = category
          .split(",")
          .map((cat) => cat.trim())
          .filter(Boolean);
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
          ...commonListAttributes, // Use common list fields
          ...langAttributes, // Use aliased title/excerpt
        ],
        distinct: true, // Important for correct count with includes/joins if added later
      });

      console.log(
        `[${timestamp}] GET /api/articles - DB Query Result: Found ${count} total, returning ${rows.length} articles for page ${page}.`
      );

      const responseData = {
        totalArticles: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        articles: rows, // rows already contain aliased fields
      };

      console.log(
        `[${timestamp}] GET /api/articles - Sending success response.`
      );
      res.setHeader("Content-Type", "application/json");
      res.json(responseData);
    } catch (error) {
      console.error(`[${timestamp}] GET /api/articles - ERROR caught:`, error);
      next(
        new ErrorHandler(
          error.message || "Server error while fetching articles.",
          error.statusCode || 500
        )
      );
    }
  }
);

// GET /api/articles/:id (Fetch single article detail - Public facing)
router.get(
  "/:id",
  (req, res, next) => {
    /* ... logging middleware ... */ next();
  },
  validateArticleIdParam, // Validate ID
  query("lang").optional().isIn(supportedLangs), // Validate optional lang
  async (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] GET /api/articles/${req.params.id} (Single Public) - Async Handler entered.`
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
      const lang = req.query.lang || "en"; // Get requested language

      // === FIX: Select ONLY necessary aliased attributes for public view ===
      const langAttributes = getLangSingleAttributes(lang); // Use SINGLE attributes (title, content)
      const attributesToFetch = [
        ...commonSingleAttributes, // Include common fields for single view
        ...langAttributes, // Include aliased title and content
      ];
      // ================================================================

      console.log(
        `[${timestamp}] GET /api/articles/${articleId} - Executing DB query with aliased attributes for lang='${lang}'...`
      );

      const article = await Article.findOne({
        where: {
          id: articleId,
          status: "published", // Ensure only published articles are publicly viewable
        },
        attributes: attributesToFetch, // Use the specific attribute list
      });

      if (!article) {
        console.warn(
          `[${timestamp}] GET /api/articles/${articleId} - Article not found or not published.`
        );
        return next(new ErrorHandler("Article Not Found", 404));
      }

      console.log(
        `[${timestamp}] GET /api/articles/${articleId} - Article found. Incrementing views and sending response.`
      );

      // Increment views (fire and forget - don't wait for it)
      Article.increment("views", { where: { id: articleId } }).catch((err) => {
        console.error(
          `[${timestamp}] GET /api/articles/${articleId} - Failed to increment view count:`,
          err
        );
      });

      res.setHeader("Content-Type", "application/json");
      // The 'article' object now contains aliased 'title' and 'content'
      res.json(article);
    } catch (error) {
      console.error(
        `[${timestamp}] GET /api/articles/${req.params.id} - ERROR caught:`,
        error
      );
      next(error); // Pass to global handler
    }
  }
);

module.exports = router;
