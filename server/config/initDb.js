const { sequelize } = require("./database");
const logger = require("winston");

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    logger.info("Database connection has been established successfully.");
    logger.info("Database models ready (no auto-sync).");
  } catch (error) {
    logger.error("Unable to connect to the database:", error);
    throw error; // Re-throw to be caught in app.js
  }
}

module.exports = initializeDatabase;
