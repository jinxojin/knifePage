// server/utils/passwordGenerator.js
const crypto = require("crypto");

/**
 * Generates a random temporary password.
 * @param {number} length - The desired length of the password (default: 12)
 * @returns {string} A random string suitable for a temporary password.
 */
function generateTemporaryPassword(length = 12) {
  // Define character sets
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  // Optional: Add symbols, but might make communication harder
  // const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

  // Combine allowed characters
  const allChars = uppercase + lowercase + numbers; // + symbols;

  let password = "";
  // Ensure at least one of each required type (if adding symbols, etc.) - basic example
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];

  // Fill the rest of the length
  const remainingLength = length - password.length;
  for (let i = 0; i < remainingLength; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password string to avoid predictable patterns (e.g., UPPERlowerNUM...)
  password = password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");

  return password;
}

module.exports = generateTemporaryPassword;
