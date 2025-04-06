// server/models/user.js
const { DataTypes, Model } = require("sequelize"); // Import Model if using class syntax
const { sequelize } = require("../config/database");
const bcrypt = require("bcrypt");

// Using class syntax for consistency if other models use it
class User extends Model {
  // Helper method to check password (optional but convenient)
  async validPassword(password) {
    return bcrypt.compare(password, this.password);
  }
}

User.init(
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // +++ Add Email Field +++
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true, // Model-level validation
      },
    },
    // ++++++++++++++++++++++++
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false, // Roles should generally be required
      defaultValue: "moderator", // Default new users to moderator? Or handle in creation logic? Let's default to moderator.
      validate: {
        isIn: [["admin", "moderator"]], // Restrict roles
      },
    },
    // +++ Add Needs Password Change Flag +++
    needsPasswordChange: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // ++++++++++++++++++++++++++++++++++++
    // id, createdAt, updatedAt are automatic
  },
  {
    sequelize,
    modelName: "User",
    hooks: {
      // Use hooks for password hashing
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password") && user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

module.exports = User;
