// server/middleware/csrfMiddleware.js
const { doubleCsrf } = require("csrf-csrf");

if (!process.env.CSRF_SECRET) {
  throw new Error("CSRF_SECRET environment variable must be set");
}

// Define the options structures
const productionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
};

const developmentCookieOptions = {
  // Add separate dev options
  httpOnly: true,
  secure: false, // Allow HTTP for local dev without HTTPS always
  sameSite: "lax", // Lax is usually fine for dev
  path: "/",
};

const testCookieOptions = {
  httpOnly: true,
  secure: false, // Allow over Supertest's simulated HTTP/S
  sameSite: "lax",
  path: "/",
};

const { invalidCsrfTokenError, generateToken, doubleCsrfProtection } =
  doubleCsrf({
    getSecret: (req) => process.env.CSRF_SECRET,
    cookieName: "__Host-x-csrf-token", // Keep __Host- prefix if using HTTPS eventually
    // === FIX: Determine cookie options dynamically inside config ===
    cookieOptions: (req) => {
      // Use a function to determine options per request/environment
      const nodeEnv = process.env.NODE_ENV || "development"; // Default to dev if unset
      console.log(
        `[CSRF Config] Determining cookie options for NODE_ENV='${nodeEnv}'`
      );
      if (nodeEnv === "production") {
        return productionCookieOptions;
      } else if (nodeEnv === "test") {
        return testCookieOptions;
      } else {
        // Default to development options
        return developmentCookieOptions;
      }
    },
    // ============================================================
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getTokenFromRequest: (req) => req.headers["x-csrf-token"],
  });

// Remove the static console.log here as options are now dynamic

module.exports = {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError,
};
