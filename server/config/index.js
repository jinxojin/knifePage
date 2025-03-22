const corsOptions = {
  origin: "http://localhost:5173", // Replace with your client's origin
  optionsSuccessStatus: 200, // For legacy browser support
};

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV,
  corsOptions,
};
