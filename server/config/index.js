// server/config/index.js
const corsOptions = {
  origin: "https://localhost:5173", // Replace with your client's HTTPS origin
  optionsSuccessStatus: 200, // For legacy browser support
  credentials: true, // Important for sending cookies, though we aren't using them *yet*
};

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV,
  corsOptions,
};
