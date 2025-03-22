// First import path
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Debug JWT_SECRET
console.log("JWT_SECRET is set:", !!process.env.JWT_SECRET);
console.log("JWT_SECRET value:", process.env.JWT_SECRET);

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error("ERROR: JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

// Import dependencies
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/database");
const articleRoutes = require("./routes/articles");
const adminRoutes = require("./routes/admin");
const ErrorHandler = require("./utils/errorHandler");
const seedAdminUser = require("./seeders/adminUser");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Configure CORS
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? "https://your-production-domain.com"
      : "http://localhost:5173", // Vite's default port
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
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
  console.error(err.stack);

  // Set the status code (default to 500 if not provided)
  const statusCode = err.statusCode || 500;

  // Send the error response
  res.status(statusCode).json({
    message: err.message,
    error: process.env.NODE_ENV === "production" ? {} : err.stack,
  });
});

// --- Database Sync and Server Start ---
sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("Database connected and synced");
    return seedAdminUser();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });
