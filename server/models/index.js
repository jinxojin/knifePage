"use strict";

const { sequelize } = require("../config/database");
const Article = require("./article");
const User = require("./user");
// +++ Import the new model +++
const SuggestedEdit = require("./suggestedEdit");

// --- Define ALL associations here ---

// User <-> SuggestedEdit
User.hasMany(SuggestedEdit, {
  foreignKey: "moderatorId", // The foreign key column in SuggestedEdit table
  as: "submittedSuggestions", // Alias to use when querying User.getSubmittedSuggestions()
});
SuggestedEdit.belongsTo(User, {
  foreignKey: "moderatorId", // The foreign key column in SuggestedEdit table
  as: "moderator", // Alias to use when querying SuggestedEdit.getModerator()
});

// Article <-> SuggestedEdit
Article.hasMany(SuggestedEdit, {
  foreignKey: "articleId", // The foreign key column in SuggestedEdit table
  as: "suggestions", // Alias to use when querying Article.getSuggestions()
});
SuggestedEdit.belongsTo(Article, {
  foreignKey: "articleId", // The foreign key column in SuggestedEdit table
  as: "article", // Alias to use when querying SuggestedEdit.getArticle()
});

// --- Export models and sequelize instance ---
module.exports = {
  sequelize,
  Article,
  User,
  SuggestedEdit, // +++ Export the new model +++
};
