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
    hooks: {
      beforeCreate: (article) => {
        const { sanitize } = require("../utils/sanitizer");
        const fields = [
          "content_en",
          "content_rus",
          "content_mng",
          "excerpt_en",
          "excerpt_rus",
          "excerpt_mng",
        ];
        fields.forEach((field) => {
          if (article[field]) {
            article[field] = sanitize(article[field]);
          }
        });
      },
      beforeUpdate: (article) => {
        const { sanitize } = require("../utils/sanitizer");
        const fields = [
          "content_en",
          "content_rus",
          "content_mng",
          "excerpt_en",
          "excerpt_rus",
          "excerpt_mng",
        ];
        fields.forEach((field) => {
          if (article.changed(field)) {
            article[field] = sanitize(article[field]);
          }
        });
      },
    },
  }
);

module.exports = Article;
