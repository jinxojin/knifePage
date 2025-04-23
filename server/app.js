// server/app.js
// --- Load Environment Variables (FIRST!) ---
const path = require("path");

// Load dotenv ONLY if NODE_ENV is NOT 'production'
if (process.env.NODE_ENV !== "production") {
  console.log(
    `NODE_ENV is '${
      process.env.NODE_ENV || "undefined"
    }', attempting to load .env file...`
  );
  const dotenvResult = require("dotenv").config({
    path: path.join(__dirname, ".env"), // Load .env from the server directory
  });

  if (dotenvResult.error) {
    // Log a warning in dev/test if .env is missing, but don't crash
    console.warn(
      "Warning: Could not load .env file. Ensure environment variables are set.",
      dotenvResult.error.message
    );
  } else {
    console.log(".env file processed.");
  }
} else {
  console.log(
    "NODE_ENV is 'production', skipping .env file load. Using system environment variables."
  );
}

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError,
} = require("./middleware/csrfMiddleware");
const articleRoutes = require("./routes/articles");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");

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
    // In production, you might configure file paths differently based on deployment summary
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// --- Centralized Configuration ---
const config = require("./config");

// --- Validate Essential Config ---
if (!config.jwtSecret) {
  logger.error(
    "FATAL ERROR: JWT_SECRET is not defined in environment variables"
  );
  process.exit(1);
}
if (!process.env.CSRF_SECRET) {
  logger.error("FATAL ERROR: CSRF_SECRET environment variable must be set");
  process.exit(1);
}

// --- Database Initialization ---
const initializeDatabase = require("./config/initDb");

// --- Sequelize Instance (used for DB connection check, not directly here usually) ---
const { sequelize } = require("./config/database");

// --- Initialize Express App ---
const app = express();

// --- Trust Proxy ---
// Set this because Nginx is acting as a reverse proxy.
// '1' means trust the first hop (Nginx). Important for express-rate-limit.
app.set("trust proxy", 1);
logger.info("Express 'trust proxy' setting enabled."); // Use logger

// --- Middleware ---

// Request Logging (Morgan) - Use logger stream
app.use(
  morgan(config.nodeEnv === "production" ? "combined" : "dev", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// CORS (Cross-Origin Resource Sharing)
logger.info(`CORS configured for origin: ${config.corsOptions.origin}`);
app.use(cors(config.corsOptions));

// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "i.imgur.com", "picsum.photos"], // Ensure allowed image sources are listed
        // Add other directives as needed (e.g., script-src, style-src)
      },
    },
  })
);

// Rate Limiting - General API Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs (adjust as needed)
  message: {
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // keyGenerator is handled correctly now due to 'trust proxy'
});

// Conditionally apply general API limiter (skip in test)
if (process.env.NODE_ENV !== "test") {
  app.use("/api/", apiLimiter);
  logger.info("Applied general API rate limiter to /api/ routes.");
} else {
  logger.info("Skipping general API rate limiter in test environment.");
}

// Body Parsers
app.use(express.json({ limit: "10mb" })); // Adjusted limit, check if 100mb is really needed
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Cookie Parser
app.use(cookieParser());

// --- CSRF Protection ---
// 1. Route to get the CSRF token
app.get("/api/csrf-token", (req, res) => {
  try {
    const csrfToken = generateToken(req, res);
    logger.debug("CSRF token generated successfully.");
    res.json({ csrfToken });
  } catch (err) {
    logger.error("Error generating CSRF token:", err);
    res.status(500).json({ message: "Failed to generate CSRF token" });
  }
});

// 2. Apply the CSRF middleware protection to subsequent routes
app.use(doubleCsrfProtection);
logger.info("Double CSRF Protection middleware applied.");

// --- Routes ---
app.use("/api", (req, res, next) => {
  logger.debug(`Request received for path: ${req.originalUrl}`);
  next();
});

app.use("/api/articles", articleRoutes);
app.use("/api/auth", authRoutes); // Password reset routes
app.use("/api/admin", adminRoutes); // Login, CRUD, User Mgmt routes

// --- Simple Hello Endpoint ---
app.get("/api/hello", (req, res) => {
  logger.debug("GET /api/hello endpoint hit.");
  res.json({ message: "Hello from the server!" });
});

// --- Error Handling Middleware (MUST be last) ---
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const statusCode = err.statusCode || 500;

  // Log detailed error including CSRF validation errors
  logger.error({
    timestamp: timestamp,
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined, // Only show stack in dev
    statusCode: statusCode,
    errors: err.errors, // Include validation errors if present
    url: req.originalUrl,
    method: req.method,
    ip: req.ip, // Will show proxy IP if trust proxy isn't set, but should be correct now
    isCsrfError: err === invalidCsrfTokenError, // Check if it's the specific CSRF error
  });

  // Specific handling for CSRF errors
  if (err === invalidCsrfTokenError) {
    if (!res.headersSent) {
      return res.status(403).json({ message: "Invalid CSRF token." });
    } else {
      logger.warn("Headers already sent for CSRF error.");
      return next(err); // Pass to default handler if headers sent
    }
  }

  // Handle Sequelize validation errors
  if (err.name === "SequelizeValidationError") {
    const validationErrors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    if (!res.headersSent) {
      return res
        .status(400)
        .json({ message: "Validation Error", errors: validationErrors });
    } else {
      logger.warn("Headers already sent for SequelizeValidationError.");
      return next(err);
    }
  }

  // General error response
  const responseMessage =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error" // Generic message in production for 500s
      : err.message || "An unexpected error occurred"; // Use error message otherwise

  if (!res.headersSent) {
    res.status(statusCode).json({
      message: responseMessage,
      // Only include validation errors for non-500s or in development
      errors:
        statusCode !== 500 || process.env.NODE_ENV !== "production"
          ? err.errors
          : undefined,
    });
  } else {
    logger.warn(
      `Headers already sent for error on ${req.originalUrl}, cannot send JSON response.`
    );
    // If headers are sent, Express's default error handler will close the connection.
    // We can't send a JSON response anymore.
    next(err);
  }
});

// --- Server Start Function ---
const startServer = async () => {
  try {
    // Initialize DB connection first
    await initializeDatabase();
    // Only require http if needed (e.g., no separate https server)
    const http = require("http");
    const server = http.createServer(app);
    server.listen(config.port, () => {
      logger.info(
        `HTTP Server is running on port ${config.port} in ${
          config.nodeEnv || "development"
        } mode`
      );
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

// --- Export the App (Before the conditional start) ---
module.exports = app;

// --- Conditionally Start Server ---
// Check if the script is being run directly
if (require.main === module) {
  logger.info("Running app.js directly, starting server...");
  startServer();
} else {
  logger.info(
    `app.js was required by ${
      process.env.NODE_ENV === "test" ? "test environment" : "another module"
    }, not starting server automatically.`
  );
  // Initialize DB connection when required for tests if not already handled
  if (process.env.NODE_ENV === "test") {
    initializeDatabase().catch((err) => {
      logger.error("Failed to initialize database when required by test:", err);
      process.exit(1); // Fail fast if DB init fails in test setup
    });
  }
}
