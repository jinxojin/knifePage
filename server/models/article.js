// server/models/article.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database"); // Adjust path if your config is elsewhere

const Article = sequelize.define(
  "Article",
  {
    // --- Language Specific Fields ---
    title_en: {
      type: DataTypes.STRING,
      allowNull: true, // Or false if English is required
    },
    title_rus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title_mng: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    content_en: {
      type: DataTypes.TEXT,
      allowNull: true, // Or false if English is required
    },
    content_rus: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    content_mng: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    excerpt_en: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    excerpt_rus: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    excerpt_mng: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // --- Other Fields ---
    category: {
      type: DataTypes.STRING,
      allowNull: false, // Keep category common
      validate: {
        // Ensures category is one of the allowed values
        isIn: [["news", "competition", "blog"]],
      },
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "published", // Default status when creating an article
      validate: {
        // Ensures status is one of the allowed values
        isIn: [["draft", "published"]],
      },
    },
    imageUrl: {
      type: DataTypes.STRING, // URL to an image
      allowNull: true, // Image is optional (Keep common)
    },
    // --- View Count Field --- (Keep common)
    views: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // ------------------------
  },
  {
    // Optional: Add table options here if needed
    // timestamps: true, // Sequelize adds createdAt and updatedAt by default
    // paranoid: true, // If you want soft deletes (adds deletedAt column)
  }
);

module.exports = Article;
