// server/app.js

// --- Load Environment Variables (FIRST!) ---
const path = require("path");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit"); // Ensure this is imported
const winston = require("winston");
//const https = require("https");
//const fs = require("fs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError,
} = require("./middleware/csrfMiddleware");
const articleRoutes = require("./routes/articles");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth"); // Requires routes/auth.js

// --- Configure Winston Logger ---
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// --- Centralized Configuration ---
const config = require("./config");

if (!config.jwtSecret) {
  logger.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}
if (!process.env.CSRF_SECRET) {
  logger.error("CSRF_SECRET environment variable must be set");
  process.exit(1);
}

// --- Database Initialization ---
const initializeDatabase = require("./config/initDb");

// --- Sequelize Instance ---
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

// --- FIX: Conditionally apply general API limiter ---
if (process.env.NODE_ENV !== "test") {
  app.use("/api/", apiLimiter); // Apply to all API routes ONLY if NOT testing
  console.log("Applied general API rate limiter.");
  logger.info("Applied general API rate limiter."); // Use logger
} else {
  console.log("Skipping general API rate limiter in test environment.");
  logger.info("Skipping general API rate limiter in test environment."); // Use logger
}
// --- End FIX ---

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
app.use("/api", (req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[${new Date().toISOString()}] Request received for path: ${
        req.originalUrl
      }`
    );
  }
  logger.debug(`Request received for path: ${req.originalUrl}`);
  next();
});

app.use("/api/articles", articleRoutes);
app.use("/api/auth", authRoutes); // Includes specific limiters applied conditionally inside
app.use("/api/admin", adminRoutes);

// --- Simple Hello Endpoint ---
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

// --- Error Handling Middleware (MUST be last) ---
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  logger.error({
    timestamp: timestamp,
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    errors: err.errors,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${timestamp}] Global Error Handler Caught:`, err);
  }

  res.setHeader("Content-Type", "application/json");

  if (err === invalidCsrfTokenError) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  if (err.name === "SequelizeValidationError") {
    const validationErrors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res
      .status(400)
      .json({ message: "Validation Error", errors: validationErrors });
  }

  const statusCode =
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
      ? err.statusCode
      : 500;

  const message = err.message || "Internal Server Error";

  const errorDetails =
    process.env.NODE_ENV === "production" ? {} : { stack: err.stack };

  const responseMessage =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : message;

  if (!res.headersSent) {
    res.status(statusCode).json({
      message: responseMessage,
      errors:
        statusCode !== 500 || process.env.NODE_ENV !== "production"
          ? err.errors
          : undefined,
      ...errorDetails,
    });
  } else {
    logger.warn(
      `Headers already sent for error on ${req.originalUrl}, cannot send JSON response.`
    );
    next(err);
  }
});

// --- HTTPS Setup ---
//const httpsOptions = {
//  key: fs.readFileSync(path.resolve(__dirname, "../localhost+2-key.pem")),
//  cert: fs.readFileSync(path.resolve(__dirname, "../localhost+2.pem")),
//};

// --- Server Start Function ---
const startServer = async () => {
  try {
    await initializeDatabase();
    const http = require('http');
    const server = http.createServer(app);
    server.listen(config.port, () => {
      logger.info(
        `HTTP Server is running on port ${config.port} in ${config.nodeEnv} mode`
      );
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

// --- Export the App (Before the conditional start) ---
module.exports = app;

// --- Conditionally Start Server ---
if (require.main === module) {
  console.log("Running app.js directly, starting server...");
  startServer();
} else {
  console.log(
    `app.js was required by ${
      process.env.NODE_ENV === "test" ? "test environment" : "another module"
    }, not starting server automatically.`
  );
  // Initialize DB connection when required for tests if not already handled by startServer call sequence
  // This ensures the DB connection is ready when tests `require(app)`
  if (process.env.NODE_ENV === "test") {
    initializeDatabase().catch((err) => {
      logger.error("Failed to initialize database when required by test:", err);
      process.exit(1); // Fail fast if DB init fails in test setup
    });
  }
}
