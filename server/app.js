// First import path
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Configure logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
});

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  logger.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

// Import application modules
const config = require("./config");
const initializeDatabase = require("./config/initDb");
const articleRoutes = require("./routes/articles");
const adminRoutes = require("./routes/admin");
const ErrorHandler = require("./utils/errorHandler");

// Initialize Express app
const app = express();


// --- Middleware ---
// Request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Configure CORS







app.use(cors(config.corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later"
});
app.use("/api/", apiLimiter);

// Body parsers
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// --- Routes ---
app.use("/api/articles", articleRoutes); // Public article routes
app.use("/api/admin", adminRoutes); // Admin routes

// Add a simple hello endpoint
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

// --- Serve Static files ---
app.use(express.static(path.join(__dirname, "../client")));

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  logger.error(err.stack);

  // Set the status code (default to 500 if not provided)
  const statusCode = err.statusCode || 500;

  // Send the error response
  res.status(statusCode).json({
    message: err.message,
    error: process.env.NODE_ENV === "production" ? {} : err.stack,
  });
});

// Start the server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Start listening
    app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

// Start the application
startServer();
