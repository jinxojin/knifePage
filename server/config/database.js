// server/config/database.js
const { Sequelize } = require("sequelize");
const path = require("path");

// Load the configuration based on NODE_ENV
const env = process.env.NODE_ENV || "development";
// Correctly require the config file relative to this file's location
const configPath = path.join(__dirname, "config.json");
// Load the specific config object for the current environment
const envConfig = require(configPath)[env]; // Use a different variable name like envConfig

console.log(`Initializing Sequelize for environment: ${env}`);

let sequelize;

// --- Create the options object ---
// Spread the options loaded from config.json (dialect, host, port, etc.)
// Set logging based on environment (using false for development now)
const sequelizeOptions = {
  ...envConfig,
  logging: false, // Disabled console logging for development (was console.log)
  // Keep false for test/production as set in config.json
};
// --------------------------------

if (envConfig.use_env_variable) {
  // Check envConfig here
  // If DATABASE_URL is specified in config.json for the environment
  console.log(
    `Connecting using DATABASE_URL from env var: ${envConfig.use_env_variable}`
  );
  // Pass the DATABASE_URL string first, then the combined options object
  sequelize = new Sequelize(
    process.env[envConfig.use_env_variable],
    sequelizeOptions
  );
} else {
  // Otherwise, use individual properties (host, user, password, etc.)
  console.log(`Connecting using individual DB parameters for env: ${env}`);
  // Pass individual credentials, then the combined options object
  sequelize = new Sequelize(
    envConfig.database,
    envConfig.username,
    envConfig.password,
    sequelizeOptions // Pass the combined options object here
  );
}

module.exports = { sequelize }; // Export the configured instance
