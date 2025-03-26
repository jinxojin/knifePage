// server/middleware/csrfMiddleware.js
const { doubleCsrf } = require("csrf-csrf");

// Ensure the CSRF_SECRET environment variable is set.  No length check here!
if (!process.env.CSRF_SECRET) {
  throw new Error("CSRF_SECRET environment variable must be set");
}

const {
  invalidCsrfTokenError, // For custom error handling (optional)
  generateToken, // Function to generate the token
  doubleCsrfProtection, // The main CSRF middleware
} = doubleCsrf({
  getSecret: (req) => process.env.CSRF_SECRET, // Get secret from .env
  cookieName: "__Host-x-csrf-token", // Use Host prefix for security
  cookieOptions: {
    httpOnly: true, // Important:  The cookie is *httpOnly*
    secure: true, // MUST be true for HTTPS
    sameSite: "strict", // Recommended for security
    path: "/", // Cookie is valid for all paths
  },
  size: 64, // Token size (in bits)
  ignoredMethods: ["GET", "HEAD", "OPTIONS"], // Methods that don't need CSRF protection
  getTokenFromRequest: (req) => req.headers["x-csrf-token"], // Get token from header
});

// Export the middleware and the token generation function
module.exports = {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError, // Optional, for custom error handling
};
