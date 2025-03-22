const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");

// --- Load Environment Variables (Correctly) ---
console.log("Loading dotenv...");
const dotenvResult = require("dotenv").config({
  path: path.join(__dirname, ".env"),
});
console.log("dotenv Result:", dotenvResult); // Check for errors
console.log("JWT_SECRET after dotenv:", process.env.JWT_SECRET);

// --- Configure Winston Logger ---
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// --- Centralized Configuration ---
const config = require("./config"); // Import from index.js
console.log("config.jwtSecret:", config.jwtSecret);

if (!config.jwtSecret) {
  logger.error("JWT_SECRET is not defined in environment variables");
  process.exit(1); // Exit if JWT_SECRET is not defined
}

// --- Database Initialization ---
const initializeDatabase = require("./config/initDb");

// --- Import Route Handlers ---
const articleRoutes = require("./routes/articles");
const adminRoutes = require("./routes/admin");

// --- Import Custom Error Handler ---
const { ErrorHandler } = require("./utils/errorHandler");

// --- Sequelize Instance (for logging the DB path) ---
const { sequelize } = require("./config/database");

// --- Initialize Express App ---
const app = express();

// --- Middleware ---

// Request Logging (Morgan)
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// CORS (Cross-Origin Resource Sharing)
app.use(cors(config.corsOptions));

// Rate Limiting (Prevent Brute-Force Attacks)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", apiLimiter);

// Body Parsers (CRUCIAL - Must be BEFORE routes)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- Routes ---
app.use("/api/articles", articleRoutes);
app.use("/api/admin", adminRoutes);

// --- Simple Hello Endpoint (for testing) ---
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

// --- Serve Static Files (from the 'client' directory) ---
app.use(express.static(path.join(__dirname, "../client")));

// --- Log Database Path (for debugging) ---
console.log("Resolved DB Path (app.js):", sequelize.options.storage);

// --- Error Handling Middleware (MUST be last) ---
app.use((err, req, res, next) => {
  logger.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const errorDetails = process.env.NODE_ENV === "production" ? {} : err.stack;

  if (err.name === "SequelizeValidationError") {
    const validationErrors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res
      .status(400)
      .json({ message: "Validation Error", errors: validationErrors });
  }

  res.status(statusCode).json({
    message: message,
    error: errorDetails,
  });
});

// --- Start the Server ---
const startServer = async () => {
  try {
    await initializeDatabase();
    await sequelize.sync({ alter: true });
    app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
