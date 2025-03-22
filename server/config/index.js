// Configuration settings for the application
module.exports = {
  port: process.env.PORT || 3000,
  corsOptions: {
    origin:
      process.env.NODE_ENV === "production"
        ? "https://your-production-domain.com"
        : "http://localhost:5173", // Vite's default port
    optionsSuccessStatus: 200,
  },
  database: {
    // Database configuration settings can go here
  }
};
