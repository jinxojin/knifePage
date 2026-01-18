// server/routes/articles.js
const express = require("express");
const router = express.Router();
const { query, param } = require("express-validator");
const articleController = require("../controllers/articleController");

const supportedLangs = ["en", "rus", "mng"];

// GET /api/articles/category/:category
router.get(
  "/category/:category",
  [
    param("category").isIn(["news", "competition", "blog"]).withMessage("Invalid category"),
    query("limit").optional().isInt({ min: 1, max: 10 }).toInt(),
    query("lang").optional().isIn(supportedLangs),
  ],
  articleController.getArticlesByCategory
);

// GET /api/articles/all (Admin View)
router.get(
  "/all",
  query("lang").optional().isIn(supportedLangs),
  articleController.getAdminAllArticles
);

// GET /api/articles (Paginated Public)
router.get(
  "/",
  [
    query("category").optional().isString(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("lang").optional().isIn(supportedLangs),
  ],
  articleController.getArticlesPaginated
);

// GET /api/articles/:id (Single Detail)
router.get(
  "/:id",
  [
    param("id").isInt().toInt(),
    query("lang").optional().isIn(supportedLangs),
  ],
  articleController.getArticleById
);

module.exports = router;
