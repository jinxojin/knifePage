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
  httpOnly: true,
  secure: false, // Allow HTTP for local dev
  sameSite: "lax",
  path: "/",
};

const testCookieOptions = {
  httpOnly: true,
  secure: false, // Allow over Supertest's simulated HTTP/S
  sameSite: "lax",
  path: "/",
};

// === FIX: Determine options object BEFORE doubleCsrf call ===
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
// ==========================================================

const { invalidCsrfTokenError, generateToken, doubleCsrfProtection } =
  doubleCsrf({
    getSecret: (req) => process.env.CSRF_SECRET,
    cookieName: "__Host-x-csrf-token",
    // === FIX: Pass the determined options object ===
    cookieOptions: cookieOpts,
    // =============================================
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getTokenFromRequest: (req) => req.headers["x-csrf-token"],
  });

module.exports = {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError,
};
