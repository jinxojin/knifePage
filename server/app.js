// server/app.js

// --- Load Environment Variables (FIRST!) ---
const path = require("path");
const dotenvResult = require("dotenv").config({
  path: path.join(__dirname, ".env"),
});
if (dotenvResult.error) {
  console.error("Error loading .env file:", dotenvResult.error);
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const https = require("https");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet"); // Import Helmet
const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError,
} = require("./middleware/csrfMiddleware");

// --- Configure Winston Logger ---
// Note: Logs might not show in console if only file transports are configured without console
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Ensure Console transport is added for console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple() // Or use json() if preferred for console too
      ),
    }),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
  // Optional: Prevent Winston from crashing on errors during logging
  // exceptionHandlers: [
  //   new winston.transports.File({ filename: 'exceptions.log' })
  // ],
  // rejectionHandlers: [
  //   new winston.transports.File({ filename: 'rejections.log' })
  // ]
});

// --- Centralized Configuration ---
const config = require("./config");

if (!config.jwtSecret) {
  logger.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}
if (!process.env.CSRF_SECRET) {
  // Re-check CSRF secret as it's critical
  logger.error("CSRF_SECRET environment variable must be set");
  process.exit(1);
}

// --- Database Initialization ---
const initializeDatabase = require("./config/initDb");

// --- Import Route Handlers ---
const articleRoutes = require("./routes/articles");
const adminRoutes = require("./routes/admin");

// --- Sequelize Instance (for logging if needed) ---
const { sequelize } = require("./config/database");

// --- Initialize Express App ---
const app = express();

// --- Middleware ---

// Request Logging (Morgan)
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// CORS (Cross-Origin Resource Sharing)
app.use(cors(config.corsOptions));

// Security Headers (Helmet)
app.use(helmet());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    message: "Too many requests from this IP, please try again later.",
  }, // Send JSON
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter); // Apply to all API routes

// Body Parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cookie Parser
app.use(cookieParser());

// --- CSRF Protection ---
// 1. Route to get the CSRF token
app.get("/api/csrf-token", (req, res) => {
  try {
    const csrfToken = generateToken(req, res);
    res.json({ csrfToken });
  } catch (err) {
    logger.error("Error generating CSRF token:", err);
    res.status(500).json({ message: "Failed to generate CSRF token" });
  }
});

// 2. Apply the CSRF middleware protection
app.use(doubleCsrfProtection);

// --- Routes ---
// +++ Add logging before routers +++
app.use("/api", (req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] Request received for path: ${
      req.originalUrl
    }`
  );
  logger.debug(`Request received for path: ${req.originalUrl}`); // Also log with Winston
  next();
});
// +++ End log +++

app.use("/api/articles", articleRoutes); // Public article routes
app.use("/api/admin", adminRoutes); // Admin routes

// --- Simple Hello Endpoint ---
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

// --- Error Handling Middleware (MUST be last) ---
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  // Log the full error stack regardless of environment
  logger.error({
    // Using Winston logger
    timestamp: timestamp,
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    errors: err.errors,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });
  // Also log to console for immediate visibility during development
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${timestamp}] Global Error Handler Caught:`, err);
  }

  // Ensure Content-Type is set to JSON for ALL error responses
  res.setHeader("Content-Type", "application/json");

  // Handle CSRF specific error
  if (err === invalidCsrfTokenError) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  // Handle Sequelize validation errors specifically
  if (err.name === "SequelizeValidationError") {
    const validationErrors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res
      .status(400) // Bad Request
      .json({ message: "Validation Error", errors: validationErrors });
  }

  // General error handling
  const statusCode =
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
      ? err.statusCode
      : 500; // Default to 500 if invalid or not set

  const message = err.message || "Internal Server Error";

  // Only send stack trace in non-production environments
  const errorDetails =
    process.env.NODE_ENV === "production" ? {} : { stack: err.stack };

  // Send generic message for 500 errors in production
  const responseMessage =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : message;

  res.status(statusCode).json({
    message: responseMessage,
    // Include structured validation errors if available and not a 500 in prod
    errors:
      statusCode !== 500 || process.env.NODE_ENV !== "production"
        ? err.errors // These are likely from express-validator
        : undefined,
    ...errorDetails, // Include stack trace only if not in production
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
      logger.info(
        `HTTPS Server is running on port ${config.port} in ${config.nodeEnv} mode`
      );
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    console.error("Failed to start server:", err); // Also log to console on critical startup failure
    process.exit(1);
  }
};

startServer();
