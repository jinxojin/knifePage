// server/config/database.js
const { Sequelize } = require("sequelize");
const path = require("path");
const logger = require("../utils/logger");

const env = process.env.NODE_ENV || "development";
const configPath = path.join(__dirname, "config.json");
const envConfig = require(configPath)[env];

logger.info(`Initializing Sequelize for environment: ${env}`);

let sequelize;

const sequelizeOptions = {
  ...envConfig,
  logging: env === "development" ? (msg) => logger.debug(msg) : false,
};

if (envConfig.dialect === "sqlite") {
  // Handle SQLite (specifically for tests)
  sequelize = new Sequelize(sequelizeOptions);
} else if (envConfig.use_env_variable) {
  logger.info(
    `Connecting using DATABASE_URL from env var: ${envConfig.use_env_variable}`
  );
  sequelize = new Sequelize(
    process.env[envConfig.use_env_variable],
    sequelizeOptions
  );
} else {
  logger.info(`Connecting using individual DB parameters for env: ${env}`);
  sequelize = new Sequelize(
    envConfig.database,
    envConfig.username,
    envConfig.password,
    sequelizeOptions
  );
}

module.exports = { sequelize };
