"use strict";

const { sequelize } = require("../config/database");

// Correctly initialize models by passing the sequelize instance to the factory functions
const Article = require("./article")(sequelize);
const User = require("./user")(sequelize);
const SuggestedEdit = require("./suggestedEdit")(sequelize);

// --- Define ALL associations here ---

// User <-> SuggestedEdit
User.hasMany(SuggestedEdit, {
  foreignKey: "moderatorId",
  as: "submittedSuggestions",
});
SuggestedEdit.belongsTo(User, {
  foreignKey: "moderatorId",
  as: "moderator",
});

// Article <-> SuggestedEdit
Article.hasMany(SuggestedEdit, {
  foreignKey: "articleId",
  as: "suggestions",
});
SuggestedEdit.belongsTo(Article, {
  foreignKey: "articleId",
  as: "article",
});

// --- Export models and sequelize instance ---
module.exports = {
  sequelize,
  Article,
  User,
  SuggestedEdit,
};