const express = require("express");
const router = express.Router();
const Article = require("../models/article");
const ErrorHandler = require("../utils/errorHandler");

// Get all articles
router.get("/", async (req, res, next) => {
  try {
    const articles = await Article.findAll({
      order: [["createdAt", "DESC"]], // Newest first
    });
    res.json(articles);
  } catch (err) {
    next(err); // Pass errors to the error handler
  }
});

// Get a single article by ID
router.get("/:id", async (req, res, next) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) {
      throw new ErrorHandler("Article not found", 404);
    }
    res.json(article);
  } catch (err) {
    next(err);
  }
});
// Get articles by category
router.get("/category/:categoryName", async (req, res, next) => {
  try {
    const articles = await Article.findAll({
      where: {
        category: req.params.categoryName,
      },
      order: [["createdAt", "DESC"]],
    });

    if (!articles || articles.length === 0) {
      // Check if articles array is empty
      throw new ErrorHandler("No articles found for this category", 404);
    }

    res.json(articles);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
