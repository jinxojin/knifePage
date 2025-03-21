const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/errorHandler");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next(new ErrorHandler("Unauthorized: No token provided", 401)); // Use ErrorHandler
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return next(new ErrorHandler("Forbidden: Invalid token", 403)); //Use ErrorHandler
    }
    req.user = user; // Attach the user data to the request object
    next(); // Continue to the next middleware or route handler
  });
}

module.exports = authenticateToken;
