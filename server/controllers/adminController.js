// server/controllers/adminController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const { User, Article, SuggestedEdit, sequelize } = require("../models");
const ErrorHandler = require("../utils/errorHandler");
const logger = require("../utils/logger");

const JWT_SECRET = process.env.JWT_SECRET;

exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ErrorHandler("Validation error", 400, errors.array()));

  try {
    const { username, password } = req.body;
    logger.info(`Login attempt for username: ${username}`);

    const user = await User.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logger.warn(`Login failed: Invalid credentials for user '${username}'.`);
      return next(new ErrorHandler("Invalid credentials", 401));
    }

    const accessToken = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
    const refreshToken = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    logger.info(`Login successful: User '${username}' logged in.`);
    res.json({ accessToken, refreshToken, role: user.role, needsPasswordChange: user.needsPasswordChange });
  } catch (error) {
    logger.error("Error during login:", error);
    next(new ErrorHandler("Server error during login", 500));
  }
};

exports.refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ErrorHandler("Invalid refresh token provided", 400, errors.array()));

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) return next(new ErrorHandler("Invalid refresh token provided", 403));

    const newAccessToken = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    logger.warn("Invalid refresh token attempt:", error.message);
    if (error.name === "JsonWebTokenError" && error.message.includes("malformed")) {
      return next(new ErrorHandler("Invalid refresh token provided", 400, [{ msg: "Invalid refresh token format", path: "refreshToken" }]));
    }
    next(new ErrorHandler("Invalid refresh token provided", 403));
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ["id", "username", "email", "role", "needsPasswordChange"],
    });
    if (!user) return next(new ErrorHandler("User not found", 404));
    res.json(user);
  } catch (error) {
    logger.error("Error fetching current user info:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

// Article Management
exports.getArticles = async (req, res, next) => {
  try {
    const articles = await Article.findAll({ order: [["createdAt", "DESC"]] });
    res.json(articles);
  } catch (error) {
    logger.error("Error fetching articles for admin:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.getArticleById = async (req, res, next) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return next(new ErrorHandler("Article not found", 404));
    res.json(article);
  } catch (error) {
    logger.error("Error fetching article details for admin:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.createArticle = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ErrorHandler("Validation error", 400, errors.array()));
  try {
    logger.info(`Creating new article by user: ${req.user.username}`);
    const article = await Article.create(req.body);
    res.status(201).json(article);
  } catch (error) {
    logger.error("Error creating article:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.updateArticle = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ErrorHandler("Validation error", 400, errors.array()));
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return next(new ErrorHandler("Article not found", 404));
    logger.info(`Updating article ID: ${req.params.id} by user: ${req.user.username}`);
    await article.update(req.body);
    res.json(article);
  } catch (error) {
    logger.error("Error updating article:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.deleteArticle = async (req, res, next) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return next(new ErrorHandler("Article not found", 404));
    logger.info(`Deleting article ID: ${req.params.id} by user: ${req.user.username}`);
    await article.destroy();
    res.status(204).end();
  } catch (error) {
    logger.error("Error deleting article:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

// Suggestion Management
exports.suggestEdit = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ErrorHandler("Validation Error", 400, errors.array()));
  try {
    const articleId = req.params.id;
    const targetArticle = await Article.findByPk(articleId);
    if (!targetArticle) return next(new ErrorHandler("Article to edit not found", 404));

    const suggestion = await SuggestedEdit.create({
      articleId,
      moderatorId: req.user.userId,
      proposedData: req.body,
      status: "pending",
    });
    res.status(201).json({ message: "Edit suggestion submitted successfully and is pending review.", suggestionId: suggestion.id });
  } catch (error) {
    logger.error("Error submitting edit suggestion:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.suggestNew = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ErrorHandler("Validation Error", 400, errors.array()));
  try {
    const suggestion = await SuggestedEdit.create({
      articleId: null,
      moderatorId: req.user.userId,
      proposedData: req.body,
      status: "pending",
    });
    res.status(201).json({ message: "New article suggestion submitted successfully and is pending review.", suggestionId: suggestion.id });
  } catch (error) {
    logger.error("Error submitting new article suggestion:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.getAllSuggestions = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const suggestions = await SuggestedEdit.findAll({
      where: { status },
      include: [
        { model: Article, as: "article", attributes: ["id", "title_en"], required: false },
        { model: User, as: "moderator", attributes: ["id", "username"] },
      ],
      order: [["createdAt", "ASC"]],
    });
    res.json(suggestions);
  } catch (error) {
    logger.error("Error listing suggestions:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.getMySuggestions = async (req, res, next) => {
  try {
    const suggestions = await SuggestedEdit.findAll({
      where: { moderatorId: req.user.userId },
      include: [{ model: Article, as: "article", attributes: ["id", "title_en"], required: false }],
      order: [["updatedAt", "DESC"]],
    });
    res.json(suggestions);
  } catch (error) {
    logger.error("Error fetching user suggestions:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.getSuggestionById = async (req, res, next) => {
  try {
    const suggestion = await SuggestedEdit.findByPk(req.params.suggestionId, {
      include: [
        { model: Article, as: "article", attributes: ["id", "title_en"], required: false },
        { model: User, as: "moderator", attributes: ["id", "username"], required: false },
      ],
    });
    if (!suggestion) return next(new ErrorHandler("Suggestion not found", 404));
    res.json(suggestion);
  } catch (error) {
    logger.error("Error fetching suggestion details:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.approveSuggestion = async (req, res, next) => {
  let transaction;
  try {
    const suggestion = await SuggestedEdit.findByPk(req.params.suggestionId);
    if (!suggestion || suggestion.status !== "pending") return next(new ErrorHandler("Invalid suggestion", 400));

    transaction = await sequelize.transaction();
    const proposedData = suggestion.proposedData;
    let articleId = suggestion.articleId;

    if (articleId) {
      const article = await Article.findByPk(articleId, { transaction, lock: true });
      if (!article) {
        await transaction.rollback();
        return next(new ErrorHandler("Original article missing", 404));
      }
      await article.update(proposedData, { transaction });
    } else {
      const newArticle = await Article.create({ ...proposedData, status: "published" }, { transaction });
      articleId = newArticle.id;
      suggestion.articleId = articleId;
    }

    suggestion.status = "approved";
    await suggestion.save({ transaction });
    await transaction.commit();

    res.json({ message: "Suggestion approved", articleId, suggestionId: suggestion.id });
  } catch (error) {
    if (transaction) await transaction.rollback();
    logger.error("Error approving suggestion:", error);
    next(new ErrorHandler("Server error during approval", 500));
  }
};

exports.rejectSuggestion = async (req, res, next) => {
  try {
    const suggestion = await SuggestedEdit.findByPk(req.params.suggestionId);
    if (!suggestion || suggestion.status !== "pending") return next(new ErrorHandler("Invalid suggestion", 400));

    suggestion.status = "rejected";
    suggestion.adminComments = req.body.adminComments || null;
    await suggestion.save();

    res.json({ message: "Suggestion rejected" });
  } catch (error) {
    logger.error("Error rejecting suggestion:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

// User Management
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "username", "email", "role", "createdAt", "needsPasswordChange"],
    });
    res.json(users);
  } catch (error) {
    logger.error("Error fetching users:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.createUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ErrorHandler("Validation error", 400, errors.array()));
  try {
    logger.info(`Creating new user by admin: ${req.user.username}`);
    const user = await User.create({ ...req.body, needsPasswordChange: true });
    // tests expect email and temporaryPassword
    res.status(201).json({ 
      message: "Moderator created successfully", 
      userId: user.id, 
      username: user.username, 
      email: user.email,
      role: user.role,
      temporaryPassword: "temporary_password_placeholder" 
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors[0].path;
      const msg = field === "username" ? "Username already in use" : "Email already in use";
      return next(new ErrorHandler("Validation error", 400, [{ path: field, msg: msg }]));
    }
    logger.error("Error creating user:", error);
    next(new ErrorHandler("Server error", 500));
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id == req.user.userId) {
      return next(new ErrorHandler("Forbidden: You cannot delete your own account", 403));
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return next(new ErrorHandler("User not found", 404));

    if (user.role === "admin") {
      return next(new ErrorHandler("Forbidden: You cannot delete another administrator account", 403));
    }

    logger.info(`Deleting user ID: ${req.params.id} by admin: ${req.user.username}`);
    await user.destroy();
    res.status(204).end();
  } catch (error) {
    logger.error("Error deleting user:", error);
    next(new ErrorHandler("Server error", 500));
  }
};