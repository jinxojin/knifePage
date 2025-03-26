// server/app.js (Corrected)

// --- Load Environment Variables (FIRST!) ---
const path = require("path");
const dotenvResult = require("dotenv").config({
  path: path.join(__dirname, ".env"),
});
if (dotenvResult.error) {
  // Check for .env loading errors
  console.error("Error loading .env file:", dotenvResult.error);
  process.exit(1); // Exit if loading fails
}
console.log("CSRF_SECRET after dotenv:", process.env.CSRF_SECRET);

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const https = require("https");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError,
} = require("./middleware/csrfMiddleware"); // Import CSRF

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
const config = require("./config");
config.corsOptions.origin = "https://localhost:5173";
console.log("config.jwtSecret:", config.jwtSecret);

if (!config.jwtSecret) {
  logger.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
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

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Use cookie-parser

// --- CSRF Protection ---
// 1. Route to get the CSRF token (must be BEFORE the middleware)
app.get("/api/csrf-token", (req, res) => {
  const csrfToken = generateToken(req, res); // Generate and set the cookie
  res.json({ csrfToken }); // Send the token in the response
});

// 2. Apply the CSRF middleware
app.use(doubleCsrfProtection);

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

  if (err === invalidCsrfTokenError) {
    // Use the exported error
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

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

// --- HTTPS Setup ---
const httpsOptions = {
  key: fs.readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
  cert: fs.readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
};

// --- Start the Server (HTTPS) ---
const startServer = async () => {
  try {
    await initializeDatabase();
    https.createServer(httpsOptions, app).listen(config.port, () => {
      logger.info(`HTTPS Server is running on port ${config.port}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
