const { Sequelize } = require("sequelize");
const path = require("path");
const config = require("./index.js"); // Import config

// Construct absolute path using __dirname
const dbPath = path.resolve(__dirname, "../data/database.sqlite"); // Use path.resolve
console.log("Database path:", dbPath); // Log absolute path
console.log("Current working directory:", process.cwd());

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath, // Use the absolute path
  logging: console.log, // Enable logging
});

module.exports = { sequelize };
