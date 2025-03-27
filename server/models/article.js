// server/models/article.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database"); // Adjust path if your config is elsewhere

const Article = sequelize.define(
  "Article",
  {
    // --- Existing Fields ---
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
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
      allowNull: true, // Image is optional
    },

    // --- NEW Excerpt Field ---
    excerpt: {
      type: DataTypes.TEXT, // Using TEXT allows flexibility in length
      allowNull: true, // This field is optional
    },
    // ------------------------

    // --- View Count Field ---
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
