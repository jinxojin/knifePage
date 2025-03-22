const sequelize = require("./database");
const seedAdminUser = require("../seeders/adminUser");
const seedArticles = require("../seeders/articleSeeder");
const winston = require("winston");

// Get the logger instance
const logger = winston.loggers.get("default") || winston.createLogger();

/**
 * Initialize the database connection and seed data
 * @returns {Promise} Resolves when database is initialized
 */
async function initializeDatabase() {
  try {
    // Sync database models
    await sequelize.sync({ alter: true });
    logger.info("Database connected and synced");
    
    // Seed initial data
    await seedAdminUser();
    logger.info("Admin user seeded");
    
    await seedArticles();
    logger.info("Articles seeded");
    
    return true;
  } catch (error) {
    logger.error("Unable to initialize database:", error);
    throw error;
  }
}

module.exports = initializeDatabase;
