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
console.log("CSRF_SECRET after dotenv:", process.env.CSRF_SECRET);

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const https = require("https");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet"); // <-- Import Helmet
const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError,
} = require("./middleware/csrfMiddleware");

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
// CORS Origin is now read within config/index.js
// console.log("config.jwtSecret:", config.jwtSecret); // Already logged in config/index.js

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
// ErrorHandler is used within routes, no need to import here unless used directly
// const { ErrorHandler } = require("./utils/errorHandler");

// --- Sequelize Instance (for logging) ---
const { sequelize } = require("./config/database");

// --- Initialize Express App ---
const app = express();

// --- Middleware ---

// Request Logging (Morgan) - Good place for it
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// CORS (Cross-Origin Resource Sharing) - Before Helmet might be slightly better, but okay here
app.use(cors(config.corsOptions));

// Security Headers (Helmet) - Add Helmet early, but after CORS potentially
// It's generally safe before rate limiting and body parsing.
app.use(helmet());
// If you encounter issues with external scripts/styles (CDNs), inline styles etc.
// try disabling CSP temporarily for debugging:
// app.use(helmet({ contentSecurityPolicy: false }));
// Then work on crafting a specific CSP policy later if needed.

// Rate Limiting (Prevent Brute-Force Attacks)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use("/api/", apiLimiter); // Apply to API routes

// Body Parsers - Needed before routes that read req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser - Needed before CSRF middleware
app.use(cookieParser());

// --- CSRF Protection ---
// 1. Route to get the CSRF token (Must be before CSRF middleware is applied to all routes)
app.get("/api/csrf-token", (req, res) => {
  try {
    const csrfToken = generateToken(req, res);
    // Log the generated token and associated cookie for debugging if needed
    // console.log("Generated CSRF Token:", csrfToken);
    // console.log("CSRF Cookie Set:", res.getHeader('Set-Cookie'));
    res.json({ csrfToken });
  } catch (err) {
    logger.error("Error generating CSRF token:", err);
    res.status(500).json({ message: "Failed to generate CSRF token" });
  }
});

// 2. Apply the CSRF middleware protection globally or to specific routes
// Applying globally after the token endpoint is common
app.use(doubleCsrfProtection);

// --- Routes ---
app.use("/api/articles", articleRoutes); // Public article routes
app.use("/api/admin", adminRoutes); // Admin routes

// --- Simple Hello Endpoint (for testing basic connectivity) ---
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

// --- Serve Static Files (Optional - If needed from server) ---
// If your client is fully separate and served by Vite/CDN, you might not need this
// app.use(express.static(path.join(__dirname, "../client/dist"))); // Example if serving built client

// --- Log Database Info (for debugging) ---
// sequelize.options.storage is specific to SQLite, won't show path for PostgreSQL
// console.log("DB Host:", sequelize.config.host); // Log host instead

// --- Error Handling Middleware (MUST be last) ---
app.use((err, req, res, next) => {
  // Log the full error stack regardless of environment
  logger.error({
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    errors: err.errors, // Include validation errors if present
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

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
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
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
    // Optionally include structured errors if available and not a 500 in prod
    errors:
      statusCode !== 500 || process.env.NODE_ENV !== "production"
        ? err.errors
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
    await initializeDatabase(); // Authenticates connection
    // NO MORE sequelize.sync() here!
    https.createServer(httpsOptions, app).listen(config.port, () => {
      logger.info(`HTTPS Server is running on port ${config.port}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
