"use strict";

const { sequelize } = require("../config/database");
const Article = require("./article");
const User = require("./user");

// Define any associations here if needed
// Example: User.hasMany(Article);
module.exports = {
  sequelize,
  Article,
  User,
};
