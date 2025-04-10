// server/middleware/csrfMiddleware.js
const { doubleCsrf } = require("csrf-csrf");

// Ensure the CSRF_SECRET environment variable is set.
if (!process.env.CSRF_SECRET) {
  // Log error and exit if secret is missing during startup
  console.error("FATAL ERROR: CSRF_SECRET environment variable must be set");
  process.exit(1); // Exit the process forcefully
}

// Define the options structures
const productionCookieOptions = {
  httpOnly: true,
  secure: true, // MUST be true for HTTPS production
  sameSite: "strict", // Recommended for security
  path: "/",
  // Consider adding MaxAge or Expires for production cookies, e.g., maxAge: 60 * 60 * 24 * 1 // 1 day in seconds
};

const developmentCookieOptions = {
  httpOnly: true,
  secure: false, // Allow HTTP for local dev without HTTPS always
  sameSite: "lax", // Lax is usually fine for dev
  path: "/",
};

const testCookieOptions = {
  httpOnly: true,
  secure: false, // IMPORTANT: Allow over Supertest's simulated HTTP/S
  sameSite: "lax",
  path: "/",
};

// Determine options object BEFORE doubleCsrf call
const nodeEnv = process.env.NODE_ENV || "development";
let cookieOpts;

if (nodeEnv === "production") {
  cookieOpts = productionCookieOptions;
} else if (nodeEnv === "test") {
  cookieOpts = testCookieOptions;
} else {
  cookieOpts = developmentCookieOptions;
}

console.log(
  `[CSRF Middleware] Using static cookie options for ENV=${nodeEnv}:`,
  cookieOpts
); // Log the chosen options

// Initialize doubleCsrf
const { invalidCsrfTokenError, generateToken, doubleCsrfProtection } =
  doubleCsrf({
    // FIX: Simplified getSecret function signature (removed unused 'req')
    getSecret: () => process.env.CSRF_SECRET,
    // -------------------------------------------------
    cookieName: "__Host-x-csrf-token", // Using recommended secure prefix
    cookieOptions: cookieOpts, // Pass the pre-determined options object
    size: 64, // Token size (bytes)
    ignoredMethods: ["GET", "HEAD", "OPTIONS"], // Methods that don't need CSRF protection
    getTokenFromRequest: (req) => req.headers["x-csrf-token"], // How to find the token in requests
  });

// Export the necessary parts
module.exports = {
  doubleCsrfProtection, // The middleware function itself
  generateToken, // Function to generate a token (used in /api/csrf-token route)
  invalidCsrfTokenError, // The specific error instance for catching CSRF errors
};
