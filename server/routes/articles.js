// server/routes/articles.js
const express = require("express");
const router = express.Router();
const { Article } = require("../models");
const { Op } = require("sequelize");
const { body, validationResult } = require("express-validator");
const { ErrorHandler } = require("../utils/errorHandler");

// GET articles by category with limit
router.get("/category/:category", async (req, res, next) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 3;

    console.log("Fetching articles with params:", { category, limit });

    const articles = await Article.findAll({
      where: {
        category: category,
        status: "published",
      },
      order: [["createdAt", "DESC"]],
      limit: limit,
    });

    console.log(`Found ${articles.length} articles for category: ${category}`);

    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles by category:", error);
    next(
      new ErrorHandler("Failed to fetch articles. Please try again later.", 500)
    );
  }
});

// GET /api/articles/all
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
      ],
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching all articles:", error);
    next(new ErrorHandler("Server error", 500));
  }
});

// GET /api/articles
router.get("/", async (req, res, next) => {
  try {
    const { category, limit } = req.query;
    const queryOptions = {
      where: {},
      order: [["createdAt", "DESC"]],
    };

    if (category) {
      queryOptions.where.category = category;
    }

    if (limit) {
      queryOptions.limit = parseInt(limit);
    }

    const articles = await Article.findAll(queryOptions);
    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    next(new ErrorHandler("Server error", 500));
  }
});

const validateArticle = [
  body("title").isString().trim().notEmpty().withMessage("Title is required"),
  body("content").isString().notEmpty().withMessage("Content is required"),
  body("category")
    .isIn(["news", "competition", "blog"])
    .withMessage("Invalid category"),
  body("author").isString().trim().notEmpty().withMessage("Author is required"), // ADD THIS
];

module.exports = router;
