const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Article = sequelize.define("Article", {
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
      isIn: [["news", "competition", "blog"]],
    },
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: "published",
    validate: {
      isIn: [["draft", "published"]],
    },
  },
  imageUrl: {
    //ADD THIS
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Article;
