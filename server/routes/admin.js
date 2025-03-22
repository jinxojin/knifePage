const express = require("express");
const router = express.Router();
const Article = require("../models/article");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/auth");
const ErrorHandler = require("../utils/errorHandler");

// --- Admin Login ---
router.post(
  "/login",
  [
    // Input validation
    body("username")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Username is required"),
    body("password").isLength({ min: 1 }).withMessage("Password is required"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Find user in database
      const user = await User.findOne({ where: { username } });

      if (!user) {
        return next(new ErrorHandler("Invalid credentials", 401));
      }

      // Check password
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return next(new ErrorHandler("Invalid credentials", 401));
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ token });
    } catch (err) {
      next(err);
    }
  }
);

// --- Create a new article (Admin-only) ---
router.post(
  "/articles",
  authenticateToken,
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Title is required"),
    body("content")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Content is required"),
    body("category")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Category is required"),
    body("author")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Author is required"),
    body("imageUrl")
      .trim()
      .isURL()
      .optional({ nullable: true, checkFalsy: true })
      .withMessage("Image URL must be a valid URL"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, content, category, author, imageUrl } = req.body;
      const newArticle = await Article.create({
        title,
        content,
        category,
        author,
        imageUrl,
      });
      res.status(201).json(newArticle);
    } catch (err) {
      next(err); // Pass errors to the error handling middleware
    }
  }
);

// --- Update an Article ---
router.put(
  "/articles/:id",
  authenticateToken,
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Title is required"),
    body("content")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Content is required"),
    body("category")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Category is required"),
    body("author")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Author is required"),
    body("imageUrl")
      .trim()
      .isURL()
      .optional({ nullable: true, checkFalsy: true })
      .withMessage("Image URL must be a valid URL"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const article = await Article.findByPk(req.params.id);
      if (!article) {
        throw new ErrorHandler("Article not found", 404);
      }

      const { title, content, category, author, imageUrl } = req.body;

      await article.update({
        title,
        content,
        category,
        author,
        imageUrl,
      });
      res.json(article);
    } catch (err) {
      next(err);
    }
  }
);

// --- Delete an Article ---
router.delete("/articles/:id", authenticateToken, async (req, res, next) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) {
      throw new ErrorHandler("Article not found", 404);
    }

    await article.destroy();
    res.json({ message: "Article deleted successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
