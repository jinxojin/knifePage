// server/models/article.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Article extends Model {}

  Article.init(
    {
      // --- Language Specific Fields ---
      title_en: { type: DataTypes.STRING, allowNull: true },
      title_rus: { type: DataTypes.STRING, allowNull: true },
      title_mng: { type: DataTypes.STRING, allowNull: true },
      content_en: { type: DataTypes.TEXT, allowNull: true },
      content_rus: { type: DataTypes.TEXT, allowNull: true },
      content_mng: { type: DataTypes.TEXT, allowNull: true },
      excerpt_en: { type: DataTypes.TEXT, allowNull: true },
      excerpt_rus: { type: DataTypes.TEXT, allowNull: true },
      excerpt_mng: { type: DataTypes.TEXT, allowNull: true },
      // --- Other Fields ---
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isIn: [["news", "competition", "blog"]] },
      },
      author: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.STRING,
        defaultValue: "published",
        validate: { isIn: [["draft", "published"]] },
      },
      imageUrl: { type: DataTypes.STRING, allowNull: true },
      views: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: "Article",
      hooks: {
        beforeCreate: (article) => {
          const { sanitize } = require("../utils/sanitizer");
          const fields = ["content_en", "content_rus", "content_mng", "excerpt_en", "excerpt_rus", "excerpt_mng"];
          fields.forEach((field) => {
            if (article[field]) article[field] = sanitize(article[field]);
          });
        },
        beforeUpdate: (article) => {
          const { sanitize } = require("../utils/sanitizer");
          const fields = ["content_en", "content_rus", "content_mng", "excerpt_en", "excerpt_rus", "excerpt_mng"];
          fields.forEach((field) => {
            if (article.changed(field)) article[field] = sanitize(article[field]);
          });
        },
      },
    }
  );

  return Article;
};