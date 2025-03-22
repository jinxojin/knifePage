// server/routes/admin.js
const express = require("express");
const router = express.Router();
const Article = require("../models/article");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/auth");
const ErrorHandler = require("../utils/errorHandler");
const sanitizeHtml = require("sanitize-html"); // Import sanitize-html

// --- Admin Login ---
router.post(
  "/login",
  [
    body("username")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Username is required"),
    body("password")
      .isLength({ min: 8 }) // Minimum password length
      .withMessage("Password must be at least 8 characters long"),
  ],
  async (req, res, next) => {
    console.log("--- Login Request Received ---");
    console.log("Request Body:", req.body);

    try {
      const errors = validationResult(req);
      console.log("Validation Errors:", errors.array());
      if (!errors.isEmpty()) {
        return next(new ErrorHandler("Validation Error", 400, errors.array()));
      }

      const { username, password } = req.body;
      console.log("Extracted Username:", username);
      console.log("Extracted Password:", password);

      const user = await User.findOne({ where: { username } });
      console.log("User Found:", user);

      if (!user) {
        console.log("User not found");
        return next(new ErrorHandler("Invalid credentials", 401));
      }

      console.log("Stored Password (from DB):", user.password);
      const match = await bcrypt.compare(password, user.password);
      console.log("Password Match:", match);

      if (!match) {
        console.log("Password comparison failed");
        return next(new ErrorHandler("Invalid credentials", 401));
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ token });
    } catch (err) {
      console.error("Login Error:", err);
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
      .isLength({ min: 5, max: 255 })
      .escape() // Escape HTML characters
      .withMessage("Title must be between 5 and 255 characters"),
    body("content")
      .trim()
      .isLength({ min: 10 })
      .escape() // Escape HTML characters
      .withMessage("Content must be at least 10 characters long"),
    body("category")
      .isIn(["news", "competition", "blog"])
      .withMessage("Invalid category"),
    body("author")
      .trim()
      .isLength({ min: 1, max: 255 })
      .escape()
      .withMessage("Author is required and must be less than 255 chars"),
    body("imageUrl")
      .trim()
      .isURL({ protocols: ["http", "https"] })
      .optional({ nullable: true, checkFalsy: true })
      .withMessage("Image URL must be a valid URL"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ErrorHandler("Validation Error", 400, errors.array()));
      }

      let { title, content, category, author, imageUrl } = req.body;

      // Sanitize the content
      content = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]), // Allow img tags
        allowedAttributes: {
          "*": ["class", "style"],
          a: ["href", "name", "target"],
          img: ["src", "alt", "title"],
        },
        allowedSchemes: ["http", "https", "data"],
      });

      const newArticle = await Article.create({
        title,
        content, // Use sanitized content
        category,
        author,
        imageUrl,
      });
      res.status(201).json(newArticle);
    } catch (err) {
      next(err);
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
      .isLength({ min: 5, max: 255 })
      .escape()
      .withMessage("Title must be between 5 and 255 characters"),
    body("content")
      .trim()
      .isLength({ min: 10 })
      .escape() // Escape HTML characters
      .withMessage("Content must be at least 10 characters long"),
    body("category")
      .isIn(["news", "competition", "blog"])
      .withMessage("Invalid category"),
    body("author")
      .trim()
      .isLength({ min: 1, max: 255 })
      .escape()
      .withMessage("Author is required and must be less than 255 chars"),
    body("imageUrl")
      .trim()
      .isURL({ protocols: ["http", "https"] })
      .optional({ nullable: true, checkFalsy: true })
      .withMessage("Image URL must be a valid URL"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ErrorHandler("Validation Error", 400, errors.array()));
      }

      const article = await Article.findByPk(req.params.id);
      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
      }

      let { title, content, category, author, imageUrl } = req.body;

      // Sanitize the content
      content = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]), // Allow img tags
        allowedAttributes: {
          "*": ["class", "style"],
          a: ["href", "name", "target"],
          img: ["src", "alt", "title"],
        },
        allowedSchemes: ["http", "https", "data"],
      });

      await article.update({
        title,
        content, // Use sanitized content
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
      return next(new ErrorHandler("Article not found", 404));
    }

    await article.destroy();
    res.json({ message: "Article deleted successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
