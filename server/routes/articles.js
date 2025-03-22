const express = require("express");
const router = express.Router();
const Article = require("../models/article");
const ErrorHandler = require("../utils/errorHandler");

// GET all articles
router.get("/", async (req, res, next) => {
  try {
    const articles = await Article.findAll({
      order: [["createdAt", "DESC"]],
    });
    res.json(articles);
  } catch (err) {
    next(err);
  }
});

// GET a single article by ID
router.get("/:id", async (req, res, next) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) {
      return next(new ErrorHandler("Article not found", 404));
    }
    res.json(article);
  } catch (err) {
    next(err);
  }
});

// GET articles by category
router.get("/category/:category", async (req, res, next) => {
  try {
    const articles = await Article.findAll({
      where: { category: req.params.category },
      order: [["createdAt", "DESC"]],
    });
    res.json(articles);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
