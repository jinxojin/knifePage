const { Sequelize } = require("sequelize");

// Database connection
const sequelize = new Sequelize({
  dialect: "sqlite", // Using SQLite for simplicity
  storage: "./database.sqlite", // File where data will be stored
  logging: false, // Set to true if you want to see SQL queries in console
});

module.exports = sequelize;
