// server/routes/articles.js
const express = require("express");
const router = express.Router();
const Article = require("../models/Article");

// GET /api/articles/all
router.get("/all", async (req, res) => {
  try {
    const articles = await Article.findAll({
      attributes: ["id", "title", "category", "createdAt"],
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching all articles:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/articles
router.get("/", async (req, res) => {
  try {
    const { category, limit } = req.query;

    console.log("Request query:", req.query); // Add this line to log the query parameters

    // Create query options
    const queryOptions = {
      where: {},
      order: [["createdAt", "DESC"]],
    };

    // Add category filter if provided
    if (category) {
      queryOptions.where.category = category;
    }

    console.log("Query options:", JSON.stringify(queryOptions)); // Add this line to log the query options

    // Add limit if provided
    if (limit) {
      queryOptions.limit = parseInt(limit);
    }

    // Execute query
    const articles = await Article.findAll(queryOptions);

    console.log(`Found ${articles.length} articles for category: ${category}`); // Add this line to log the results

    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
