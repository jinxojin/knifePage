// server/models/user.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const bcrypt = require("bcrypt"); // USE BCRYPT

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
  const hashedPassword = await bcrypt.hash(user.password, 10); // USE BCRYPT
  user.password = hashedPassword;
});

// Hash the password before updating a user, but ONLY if it's changed.
User.beforeUpdate(async (user) => {
  if (user.changed("password")) {
    const hashedPassword = await bcrypt.hash(user.password, 10); // USE BCRYPT
    user.password = hashedPassword;
  }
});

module.exports = User;
