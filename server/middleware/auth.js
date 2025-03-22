const jwt = require("jsonwebtoken");
const { ErrorHandler } = require("../utils/errorHandler");
const config = require("../config"); // Import config

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next(new ErrorHandler("Unauthorized: No token provided", 401));
  }
  // Use config.jwtSecret here
  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      return next(new ErrorHandler("Forbidden: Invalid token", 403));
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
