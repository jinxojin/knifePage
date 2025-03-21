const express = require("express");
const cors = require("cors");
const sequelize = require("./config/database");
const articleRoutes = require("./routes/articles");
const adminRoutes = require("./routes/admin");
const ErrorHandler = require("./utils/errorHandler");
const path = require("path");
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins (for development)
app.use(express.json()); // Use built-in JSON body parsing
app.use(express.urlencoded({ extended: true })); // Use built-in URL-encoded body parsing

// --- Routes ---
app.use("/api/articles", articleRoutes); // Public article routes
app.use("/api/admin", adminRoutes); // Admin routes

// --- Serve Static files (IMPORTANT) ---
app.use(express.static(path.join(__dirname, "../client")));

// --- Error Handling Middleware (Must be after routes) ---
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack trace

  // Set the status code (default to 500 if not provided)
  const statusCode = err.statusCode || 500;

  // Send the error response
  res.status(statusCode).json({
    message: err.message,
    error: process.env.NODE_ENV === "production" ? {} : err.stack, // Don't expose stack trace in production
  });
});

// --- Database Sync ---
sequelize
  .sync()
  .then(() => {
    console.log("Database synced");
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => console.error("Error syncing database:", err));
