// server/utils/errorHandler.js
// Enhance error handling with more specific error types
class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
    this.errors = errors;
  }
}

// Custom Error Handler
class ErrorHandler extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorHandler;
