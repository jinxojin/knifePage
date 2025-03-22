// server/models/user.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { scryptSync, randomBytes, timingSafeEqual } = require("crypto"); // Import scryptSync

const User = sequelize.define("User", {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: "admin",
  },
});

// Hash the password before creating a user
User.beforeCreate(async (user) => {
  const salt = randomBytes(16).toString("hex"); // Generate a random salt
  const hashedPassword = scryptSync(user.password, salt, 64).toString("hex"); // Hash with scrypt
  user.password = `${salt}:${hashedPassword}`; // Store salt and hash together
});

// Hash the password before updating a user, but ONLY if it's changed.
User.beforeUpdate(async (user) => {
  if (user.changed("password")) {
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = scryptSync(user.password, salt, 64).toString("hex");
    user.password = `${salt}:${hashedPassword}`;
  }
});

module.exports = User;
