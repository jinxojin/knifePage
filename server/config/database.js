// server/config/database.js
const { Sequelize } = require("sequelize");
const path = require("path");

// Load the configuration based on NODE_ENV
const env = process.env.NODE_ENV || "development";
// Correctly require the config file relative to this file's location
const configPath = path.join(__dirname, "config.json");
const config = require(configPath)[env];

console.log(`Initializing Sequelize for environment: ${env}`);
// console.log("Using DB config:", config); // Uncomment for debugging connection details

let sequelize;

if (config.use_env_variable) {
  // If DATABASE_URL is specified in config.json for the environment
  console.log(
    `Connecting using DATABASE_URL from env var: ${config.use_env_variable}`
  );
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  // Otherwise, use individual properties (host, user, password, etc.)
  console.log(`Connecting using individual DB parameters for env: ${env}`);
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config // Pass the whole config object for dialect, host, port, options etc.
  );
}

module.exports = { sequelize }; // Export the configured instance
