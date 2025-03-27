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

// --- Routes ---

// GET articles by category with limit
router.get(
  "/category/:category",
  validateCategoryParam,
  validateGetArticlesQuery,
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

      const articles = await Article.findAll({
        where: {
          category: category,
          status: "published",
        },
        order: [["createdAt", "DESC"]],
        limit: limit,
        attributes: [
          "id",
          "title",
          // "content", // Typically not needed for list view, send excerpt instead
          "category",
          "author",
          "imageUrl",
          "createdAt",
          "updatedAt",
          "excerpt", // <-- Include excerpt
          "views",   // <-- Include views
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

// GET /api/articles/all - Simple list
router.get("/all", async (req, res, next) => {
  try {
    const articles = await Article.findAll({
      attributes: [
        "id",
        "title",
        "category",
        "createdAt",
        "imageUrl",
        "author",
        "status",
        "excerpt", // <-- Include excerpt
        "views",   // <-- Include views
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching all articles:", error);
    next(new ErrorHandler("Server error while fetching articles.", 500));
  }
});

// GET /api/articles (General purpose list with filters)
router.get("/", validateGetArticlesQuery, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Get Articles Validation Errors:", errors.array());
    return next(
      new ErrorHandler("Invalid query parameters", 400, errors.array())
    );
  }

  try {
    const { category, limit: queryLimit } = req.query;
    const limit = queryLimit || 10; // Default limit

    const queryOptions = {
      where: {
        status: "published",
      },
      order: [["createdAt", "DESC"]],
      limit: limit,
      attributes: [
        "id",
        "title",
        // "content", // Typically not needed for list view
        "category",
        "author",
        "imageUrl",
          "createdAt",
          "updatedAt",
          "excerpt", // <-- Include excerpt
          "views",   // <-- Include views
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
router.get("/:id", validateArticleIdParam, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Get Article by ID Validation Errors:", errors.array());
    return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
  }

  try {
    const articleId = req.params.id;
    // findOne/findByPk usually returns all attributes by default
    const article = await Article.findOne({
      where: {
        id: articleId,
        status: "published", // Only published for public view by ID
      },
      // No need to specify attributes unless excluding something
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
