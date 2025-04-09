// server/models/user.js
const { DataTypes, Model } = require("sequelize"); // Import Model if using class syntax
const { sequelize } = require("../config/database");
const bcrypt = require("bcrypt");

// Using class syntax for consistency if other models use it
class User extends Model {
  // Helper method to check password (optional but convenient)
  async validPassword(password) {
    // Ensure comparison happens against the correct instance property 'this.password'
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
    email: {
      // Ensure email field is present
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true, // Model-level validation
      },
    },
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
      defaultValue: "moderator",
      validate: {
        isIn: [["admin", "moderator"]], // Restrict roles
      },
    },
    needsPasswordChange: {
      // Ensure flag is present
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // +++ Password Reset Fields (From Migration) +++
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE, // Match migration type
      allowNull: true,
    },
    // ++++++++++++++++++++++++++++++++++++++++++++++++++
    // id, createdAt, updatedAt are automatic
  },
  {
    sequelize,
    modelName: "User",
    hooks: {
      // Use hooks for password hashing
      beforeCreate: async (user) => {
        if (user.password) {
          console.log("beforeCreate hook: Hashing password..."); // Added log
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      // +++ beforeUpdate hook is now UNCOMMENTED +++
      beforeUpdate: async (user) => {
        // Hash password if it has changed AND is not null/undefined
        if (user.changed("password") && user.password) {
          console.log("beforeUpdate hook: Hashing password change..."); // Keep log
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        } else if (user.changed("password")) {
          console.log(
            "beforeUpdate hook: Password changed but is null/empty, skipping hash."
          );
        } else {
          console.log(
            "beforeUpdate hook: Password not changed, skipping hash."
          ); // Keep log
        }
        // Note: We are NOT hashing passwordResetToken here. That's handled in the route.
      },
      // ++++++++++++++++++++++++++++++++++++++++++++++
    },
  }
);

module.exports = User;
