// server/test.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("JWT_SECRET:", process.env.JWT_SECRET);
