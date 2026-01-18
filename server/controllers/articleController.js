// server/controllers/articleController.js
const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const { Article } = require("../models");
const ErrorHandler = require("../utils/errorHandler");
const logger = require("../utils/logger");

const supportedLangs = ["en", "rus", "mng"];

const getLangListAttributes = (lang) => [
  [`title_${lang}`, "title"],
  [`excerpt_${lang}`, "excerpt"],
];

const getLangSingleAttributes = (lang) => [
  [`title_${lang}`, "title"],
  [`content_${lang}`, "content"],
];

const commonListAttributes = ["id", "category", "author", "imageUrl", "createdAt", "views"];
const commonSingleAttributes = ["id", "category", "author", "imageUrl", "createdAt", "updatedAt", "views"];

exports.getArticlesByCategory = async (req, res, next) => {
  const timestamp = new Date().toISOString();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[${timestamp}] GET /api/articles/category/${req.params.category} - Validation Errors:`, errors.array());
    return next(new ErrorHandler("Invalid request parameters", 400, errors.array()));
  }
  try {
    const { category } = req.params;
    const limit = req.query.limit || 1;
    const lang = req.query.lang || "en";
    const langAttributes = getLangListAttributes(lang);

    const articles = await Article.findAll({
      where: { category: category, status: "published" },
      order: [["createdAt", "DESC"]],
      limit: limit,
      attributes: [...commonListAttributes, ...langAttributes],
    });
    res.json(articles);
  } catch (error) {
    logger.error(`[${timestamp}] GET /api/articles/category/${req.params.category} - ERROR caught:`, error);
    next(new ErrorHandler(error.message || "Failed to fetch articles.", 500));
  }
};

exports.getAdminAllArticles = async (req, res, next) => {
  const timestamp = new Date().toISOString();
  try {
    const articles = await Article.findAll({
      attributes: [
        "id", "category", "author", "imageUrl", "createdAt", "updatedAt", "views", "status",
        "title_en", "content_en", "excerpt_en",
        "title_rus", "content_rus", "excerpt_rus",
        "title_mng", "content_mng", "excerpt_mng",
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(articles);
  } catch (error) {
    logger.error(`[${timestamp}] GET /api/articles/all - ERROR caught:`, error);
    next(new ErrorHandler(error.message || "Server error while fetching articles.", 500));
  }
};

exports.getArticlesPaginated = async (req, res, next) => {
  const timestamp = new Date().toISOString();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[${timestamp}] GET /api/articles - Validation Errors:`, errors.array());
    return next(new ErrorHandler("Invalid query parameters", 400, errors.array()));
  }

  try {
    const { category, limit: queryLimit, page: queryPage, lang } = req.query;
    const limit = queryLimit || 6;
    const page = queryPage || 1;
    const offset = (page - 1) * limit;
    const currentLang = lang || "en";
    const langAttributes = getLangListAttributes(currentLang);

    const whereClause = { status: "published" };
    if (category) {
      const categories = category.split(",").map(c => c.trim()).filter(Boolean);
      if (categories.length > 0) whereClause.category = { [Op.in]: categories };
    }

    const { count, rows } = await Article.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: limit,
      offset: offset,
      attributes: [...commonListAttributes, ...langAttributes],
      distinct: true,
    });

    res.json({
      totalArticles: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      articles: rows,
    });
  } catch (error) {
    logger.error(`[${timestamp}] GET /api/articles - ERROR caught:`, error);
    next(new ErrorHandler(error.message || "Server error while fetching articles.", 500));
  }
};

exports.getArticleById = async (req, res, next) => {
  const timestamp = new Date().toISOString();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[${timestamp}] GET /api/articles/${req.params.id} - Validation Errors:`, errors.array());
    return next(new ErrorHandler("Invalid Article ID or Language", 400, errors.array()));
  }

  try {
    const articleId = req.params.id;
    const lang = req.query.lang || "en";
    const langAttributes = getLangSingleAttributes(lang);

    const article = await Article.findOne({
      where: { id: articleId, status: "published" },
      attributes: [...commonSingleAttributes, ...langAttributes],
    });

    if (!article) return next(new ErrorHandler("Article Not Found", 404));

    Article.increment("views", { where: { id: articleId } }).catch(err => {
      logger.error(`[${timestamp}] GET /api/articles/${articleId} - Failed to increment view count:`, err);
    });

    res.json(article);
  } catch (error) {
    logger.error(`[${timestamp}] GET /api/articles/${req.params.id} - ERROR caught:`, error);
    next(new ErrorHandler(error.message || "Server error while fetching article.", 500));
  }
};
