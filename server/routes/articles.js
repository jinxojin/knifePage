// server/routes/articles.js
const express = require("express");
const router = express.Router();
const { query, param, validationResult } = require("express-validator");
const { Op } = require("sequelize");

const { Article } = require("../models"); // Assuming models are exported correctly
const ErrorHandler = require("../utils/errorHandler");

// --- Validation Middleware ---

const validateGetArticlesQuery = [
  query("category")
    .optional()
    .isIn(["news", "competition", "blog"])
    .withMessage("Invalid category specified"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 }) // Set a reasonable max limit
    .toInt()
    .withMessage("Limit must be a positive integer (max 50)"),
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

// Language validation
const supportedLangs = ['en', 'rus', 'mng'];
const validateLangQuery = [
  query('lang')
    .optional()
    .isIn(supportedLangs)
    .withMessage(`Invalid language code. Supported: ${supportedLangs.join(', ')}`),
];

// Helper to get language attributes with aliases
const getLangAttributes = (lang = 'en') => {
  // Ensure lang is valid, default to 'en'
  const validLang = supportedLangs.includes(lang) ? lang : 'en';
  return [
    [`title_${validLang}`, 'title'],
    [`content_${validLang}`, 'content'],
    [`excerpt_${validLang}`, 'excerpt'],
  ];
};

// Common attributes needed for lists/details (excluding language-specific ones)
const commonAttributes = [
  "id",
  "category",
  "author",
  "imageUrl",
  "createdAt",
  "updatedAt", // Keep updatedAt for potential display/sorting
  "views",
  "status", // Needed for admin list, maybe useful for public too
];


// --- Routes ---

// GET articles by category with limit
router.get(
  "/category/:category",
  validateCategoryParam,
  validateGetArticlesQuery, // Keep limit validation
  validateLangQuery,      // Add language validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(
        "Get Articles by Category Validation Errors:",
        errors.array()
      );
      return next(
        new ErrorHandler("Invalid request parameters", 400, errors.array())
      );
    }

    try {
      const { category } = req.params;
      const limit = req.query.limit || 10; // Default limit
      const lang = req.query.lang; // Get requested language

      const langAttributes = getLangAttributes(lang);

      const articles = await Article.findAll({
        where: {
          category: category,
          status: "published",
        },
        order: [["createdAt", "DESC"]],
        limit: limit,
        // Combine common attributes with aliased language attributes
        // Note: We only need excerpt for lists, not full content
        attributes: [
          ...commonAttributes.filter(attr => !['content', 'status'].includes(attr)), // Exclude content/status from list view
          ...langAttributes.filter(attr => attr[1] !== 'content') // Exclude aliased 'content'
        ],
      });
      
      res.json(articles);
    } catch (error) {
      console.error(
        `Error fetching articles by category (${req.params.category}):`,
        error
      );
      next(new ErrorHandler("Failed to fetch articles.", 500));
    }
  }
);

// GET /api/articles/all - Simple list (likely for admin, includes status)
router.get("/all", validateLangQuery, async (req, res, next) => { // Add lang validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorHandler("Invalid query parameters", 400, errors.array()));
  }
  try {
    const lang = req.query.lang;
    const langAttributes = getLangAttributes(lang);

    const articles = await Article.findAll({
       // Reverted Debugging Change: Combine common attributes (including status) with aliased language attributes
       // Exclude full content from this list view
      attributes: [
        ...commonAttributes.filter(attr => attr !== 'content'), // Keep status, exclude content
        ...langAttributes.filter(attr => attr[1] !== 'content') // Exclude aliased 'content'
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching all articles:", error);
    next(new ErrorHandler("Server error while fetching articles.", 500));
  }
});

// GET /api/articles (General purpose public list with filters)
router.get("/", validateGetArticlesQuery, validateLangQuery, async (req, res, next) => { // Add lang validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Get Articles Validation Errors:", errors.array());
    return next(
      new ErrorHandler("Invalid query parameters", 400, errors.array())
    );
  }

  try {
    const { category, limit: queryLimit, lang } = req.query; // Get lang
    const limit = queryLimit || 10; // Default limit
    const langAttributes = getLangAttributes(lang);

    const queryOptions = {
      where: {
        status: "published",
      },
      order: [["createdAt", "DESC"]],
      limit: limit,
      // Combine common attributes with aliased language attributes
      // Exclude full content and status from public list view
      attributes: [
        ...commonAttributes.filter(attr => !['content', 'status'].includes(attr)),
        ...langAttributes.filter(attr => attr[1] !== 'content') // Exclude aliased 'content'
      ],
    };
    if (category) {
      queryOptions.where.category = category;
    }

    const articles = await Article.findAll(queryOptions);
    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    next(new ErrorHandler("Server error while fetching articles.", 500));
  }
});

// GET /api/articles/:id (Fetch single article)
router.get("/:id", validateArticleIdParam, validateLangQuery, async (req, res, next) => { // Add lang validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Get Article by ID Validation Errors:", errors.array());
    return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
  }

  try {
    const articleId = req.params.id;
    const lang = req.query.lang; // Get lang

    // Determine attributes based on authentication
    let attributesToFetch;
    if (req.user) { 
      // Authenticated user (admin editing) - fetch all fields
      attributesToFetch = [
        ...commonAttributes,
        'title_en', 'content_en', 'excerpt_en',
        'title_rus', 'content_rus', 'excerpt_rus',
        'title_mng', 'content_mng', 'excerpt_mng',
      ];
    } else {
      // Public view - fetch common fields + aliased language fields
      const langAttributes = getLangAttributes(lang);
      attributesToFetch = [
        ...commonAttributes, // Include all common fields for detail view
        ...langAttributes    // Include all aliased language fields
      ];
    }

    // Fetch article with determined attributes
    const article = await Article.findOne({
      where: {
        id: articleId,
        // Allow admin to fetch non-published articles too? Maybe add later.
        // For now, keep status: "published" for simplicity, or remove if admin should see drafts
        status: "published", 
      },
      attributes: attributesToFetch,
    });

    if (!article) {
      return next(new ErrorHandler("Article Not Found", 404));
    }

    // Increment the view count (fire-and-forget, no need to wait for it to complete before sending response)
    article.increment('views').catch(err => {
      // Log error if increment fails, but don't block the response
      console.error(`Failed to increment view count for article ${articleId}:`, err);
    });

    res.json(article); // Send the article data (including the *previous* view count)
  } catch (error) {
    console.error(`Error fetching article by ID (${req.params.id}):`, error);
    next(error);
  }
});

module.exports = router;
