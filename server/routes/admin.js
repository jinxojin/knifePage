// server/routes/admin.js
const express = require("express");
const router = express.Router();
const Article = require("../models/article");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/auth");
const { ErrorHandler } = require("../utils/errorHandler"); // CORRECT import
const { scryptSync, timingSafeEqual } = require("crypto");

// --- Admin Login ---
router.post(
  "/login",
  [
    body("username")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .withMessage("Username is required"),
    body("password").isLength({ min: 1 }).withMessage("Password is required"),
  ],
  async (req, res, next) => {
    console.log("--- Login Request Received ---"); // Marker
    console.log("Request Body:", req.body);

    try {
      const errors = validationResult(req);
      console.log("Validation Errors:", errors.array());
      if (!errors.isEmpty()) {
        return next(new ErrorHandler("Validation Error", 400, errors.array())); // CORRECT usage
      }

      const { username, password } = req.body;
      console.log("Extracted Username:", username);
      console.log("Extracted Password:", password);

      const user = await User.findOne({ where: { username } });
      console.log("User Found:", user); // Log the entire user object

      if (!user) {
        console.log("User not found"); // Log if user is not found
        return next(new ErrorHandler("Invalid credentials", 401)); // CORRECT usage
      }

      // --- Verify password with scrypt ---
      console.log("Stored Password (from DB):", user.password); // Log stored password
      const [salt, key] = user.password.split(":"); // Split into salt and hash
      console.log("Extracted Salt:", salt);
      console.log("Extracted Key (Hash):", key);

      // Hash the entered password using scrypt and the extracted salt
      const hashedBuffer = scryptSync(password, salt, 64);
      const hashedHex = hashedBuffer.toString("hex"); // Convert to hex string
      console.log("Hashed Buffer (from entered password):", hashedHex); // Log as hex

      // Convert stored hash to buffer
      const keyBuffer = Buffer.from(key, "hex");
      console.log("Key Buffer (from stored hash):", keyBuffer.toString("hex"));

      // Use timingSafeEqual for secure comparison
      const match = timingSafeEqual(Buffer.from(hashedHex, "hex"), keyBuffer); // Correct comparison
      console.log("Password Match:", match);

      if (!match) {
        console.log("Password comparison failed"); // Log comparison failure
        return next(new ErrorHandler("Invalid credentials", 401)); // CORRECT usage
      }
      // --- End scrypt verification ---

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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ErrorHandler("Validation Error", 400, errors.array()));
      }

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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ErrorHandler("Validation Error", 400, errors.array()));
      }
      const article = await Article.findByPk(req.params.id);
      if (!article) {
        return next(new ErrorHandler("Article not found", 404));
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
      return next(new ErrorHandler("Article not found", 404));
    }

    await article.destroy();
    res.json({ message: "Article deleted successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
