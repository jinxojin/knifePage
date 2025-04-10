// server/middleware/csrfMiddleware.js
const { doubleCsrf } = require("csrf-csrf");

// Ensure the CSRF_SECRET environment variable is set.
if (!process.env.CSRF_SECRET) {
  throw new Error("CSRF_SECRET environment variable must be set");
}

// --- Determine Cookie Options based on Environment ---
const isTestEnv = process.env.NODE_ENV === "test";

// Production settings (keep these secure)
const productionCookieOptions = {
  httpOnly: true,
  secure: true, // MUST be true for HTTPS production
  sameSite: "strict", // Recommended for security
  path: "/",
  // Consider adding MaxAge or Expires for production cookies
};

// Testing settings (relaxed for Supertest agent)
const testCookieOptions = {
  httpOnly: true, // Keep HttpOnly if possible
  secure: false, // IMPORTANT: Allow over Supertest's simulated HTTP/S
  sameSite: "lax", // Relax SameSite for testing agent
  path: "/",
};

// Choose options based on environment
const cookieOpts = isTestEnv ? testCookieOptions : productionCookieOptions;
// --- End Cookie Options ---

const { invalidCsrfTokenError, generateToken, doubleCsrfProtection } =
  doubleCsrf({
    getSecret: (req) => process.env.CSRF_SECRET, // Get secret from .env
    // Use a simpler cookie name for testing if __Host- prefix causes issues,
    // but let's try keeping it first. It might be okay with secure:false.
    cookieName: "__Host-x-csrf-token",
    // cookieName: isTestEnv ? "csrf-token-test" : "__Host-x-csrf-token", // Alternative if needed
    cookieOptions: cookieOpts, // Use environment-specific options
    size: 64, // Token size
    ignoredMethods: ["GET", "HEAD", "OPTIONS"], // Methods that don't need CSRF protection
    getTokenFromRequest: (req) => req.headers["x-csrf-token"], // Get token from header
  });

// Log which options are being used (helps debugging)
console.log(
  `CSRF Middleware using cookie options for ENV=${
    process.env.NODE_ENV || "undefined"
  }:`,
  cookieOpts
);

// Export the middleware and the token generation function
module.exports = {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError, // Optional, for custom error handling
};
