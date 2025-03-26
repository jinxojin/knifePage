// server/config/index.js

// Read CORS origin from environment variable, fallback to localhost for development
const allowedOrigin = process.env.CORS_ORIGIN || "https://localhost:5173";
console.log(`Configuring CORS for origin: ${allowedOrigin}`); // Log the origin being used

const corsOptions = {
  origin: allowedOrigin, // Use the variable here
  optionsSuccessStatus: 200, // For legacy browser support
  credentials: true, // Important for sending cookies
};

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV,
  corsOptions, // Export the dynamically configured options
};
