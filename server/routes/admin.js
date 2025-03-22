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
const sanitizeHtml = require("sanitize-html");
const crypto = require("crypto"); // Import crypto

// --- Helper function to generate JWT ---
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // Short expiration time! 15 minutes
  );
}

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
      .isLength({ min: 8 })
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

      // --- Generate Tokens ---
      const accessToken = generateAccessToken(user); // Use helper function
      const refreshToken = crypto.randomBytes(64).toString("hex"); // Generate a random refresh token

      // --- Store Refresh Token in Database ---
      user.refreshToken = refreshToken;
      await user.save();

      console.log("Refresh Token Stored:", refreshToken);

      // Send *both* tokens to the client
      res.json({ accessToken, refreshToken });
    } catch (err) {
      console.error("Login Error:", err);
      next(err);
    }
  }
);

// --- Refresh Token Route ---
router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      return next(new ErrorHandler("Refresh token is required", 400));
    }

    const user = await User.findOne({ where: { refreshToken } });

    if (!user) {
      return next(new ErrorHandler("Invalid refresh token", 403));
    }

    // --- Generate a NEW access token ---
    const accessToken = generateAccessToken(user);

    // (Optionally, generate a new refresh token here and update the database)

    res.json({ accessToken }); // Send the new access token
  } catch (err) {
    next(err);
  }
});

// --- Create a new article (Admin-only) ---
router.post(
  "/articles",
  authenticateToken, // Use the updated middleware
  [
    body("title")
      .trim()
      .isLength({ min: 5, max: 255 })
      .escape()
      .withMessage("Title must be between 5 and 255 characters"),
    body("content")
      .trim()
      .isLength({ min: 10 })
      .escape()
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
    // ... (rest of your create article route - NO CHANGES HERE)
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
  authenticateToken, // Use the updated middleware
  [
    body("title")
      .trim()
      .isLength({ min: 5, max: 255 })
      .escape()
      .withMessage("Title must be between 5 and 255 characters"),
    body("content")
      .trim()
      .isLength({ min: 10 })
      .escape()
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
    // ... (rest of your update article route - NO CHANGES HERE) ...
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
  // ... (rest of your delete article route - NO CHANGES HERE) ...
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
