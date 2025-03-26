// server/routes/articles.js
const express = require("express");
const router = express.Router();
const { query, param, validationResult } = require("express-validator"); // Import query and param
const { Op } = require("sequelize");

const { Article } = require("../models"); // Assuming models are exported correctly
const ErrorHandler = require("../utils/errorHandler"); // Corrected import

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
    .toInt(), // Convert valid string ID to integer
];

// --- Routes ---

// GET articles by category with limit
router.get(
  "/category/:category",
  validateCategoryParam, // Validate the category in the URL
  validateGetArticlesQuery, // Also validate optional limit query param
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
      const { category } = req.params; // Validated
      // Use default AFTER validation checks, validated limit is in req.query
      const limit = req.query.limit || 10; // Default limit if not provided or invalid

      console.log("Fetching articles with validated params:", {
        category,
        limit,
      });

      const articles = await Article.findAll({
        where: {
          category: category,
          status: "published", // Ensure only published articles are shown
        },
        order: [["createdAt", "DESC"]],
        limit: limit,
        attributes: [
          // Explicitly list public attributes
          "id",
          "title",
          "content", // Consider if full content is needed for list views, maybe excerpt later?
          "category",
          "author",
          "imageUrl",
          "createdAt",
          "updatedAt", // Include updatedAt if useful for display
        ],
      });

      console.log(
        `Found ${articles.length} articles for category: ${category}`
      );
      res.json(articles);
    } catch (error) {
      console.error(
        `Error fetching articles by category (${req.params.category}):`,
        error
      );
      // Use generic error for public routes
      next(new ErrorHandler("Failed to fetch articles.", 500));
    }
  }
);

// GET /api/articles/all - Simple list, maybe for admin or specific use?
router.get("/all", async (req, res, next) => {
  // No validation needed as no input is taken
  try {
    const articles = await Article.findAll({
      attributes: [
        // Define attributes needed for this specific list
        "id",
        "title",
        "category",
        "createdAt",
        "imageUrl",
        "author",
        "status", // Maybe include status for an admin view?
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
router.get(
  "/",
  validateGetArticlesQuery, // Validate optional query params
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Get Articles Validation Errors:", errors.array());
      return next(
        new ErrorHandler("Invalid query parameters", 400, errors.array())
      );
    }

    try {
      // Use validated query parameters
      const { category, limit: queryLimit } = req.query; // Renamed limit to avoid conflict
      const limit = queryLimit || 10; // Apply default limit

      const queryOptions = {
        where: {
          status: "published", // Always filter by published for public view
        },
        order: [["createdAt", "DESC"]],
        limit: limit,
        attributes: [
          // Explicitly list public attributes
          "id",
          "title",
          "content",
          "category",
          "author",
          "imageUrl",
          "createdAt",
          "updatedAt",
        ],
      };

      if (category) {
        queryOptions.where.category = category; // Add category filter if valid
      }

      const articles = await Article.findAll(queryOptions);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles:", error);
      next(new ErrorHandler("Server error while fetching articles.", 500));
    }
  }
);

// GET /api/articles/:id (Fetch single article)
router.get(
  "/:id",
  validateArticleIdParam, // Validate the ID parameter
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Get Article by ID Validation Errors:", errors.array());
      return next(new ErrorHandler("Invalid Article ID", 400, errors.array()));
    }

    try {
      const articleId = req.params.id; // Already validated and converted to int
      const article = await Article.findOne({
        // Use findOne for clarity
        where: {
          id: articleId,
          status: "published", // Ensure only published articles are directly accessible by ID publicly
        },
        // Exclude sensitive fields if any were added to the model later
        // attributes: { exclude: ['someInternalField'] }
      });

      if (!article) {
        // Use 404 for resource not found
        return next(new ErrorHandler("Article Not Found", 404));
      }

      res.json(article);
    } catch (error) {
      console.error(`Error fetching article by ID (${req.params.id}):`, error);
      next(error); // Pass to central error handler
    }
  }
);

module.exports = router;
