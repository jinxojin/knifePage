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
          console.log("beforeCreate hook: Hashing password...");
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
          console.log("beforeCreate hook: Hashing DONE."); // Added confirmation log
        }
      },
      beforeUpdate: async (user) => {
        // === START DEBUG LOGGING ===
        const changedFields = user.changed(); // Get list of changed fields
        console.log("beforeUpdate hook: User ID:", user.id);
        console.log("beforeUpdate hook: Changed fields:", changedFields);
        console.log(
          "beforeUpdate hook: Password field changed?",
          user.changed("password")
        );
        if (user.changed("password")) {
          // Log the value BEFORE it potentially gets hashed
          console.log(
            "beforeUpdate hook: user.password value BEFORE hashing/assignment:",
            user.password
          );
        }
        // === END DEBUG LOGGING ===

        // Check if 'password' is among the changed fields AND if the new value is not null/undefined
        if (user.changed("password") && user.password) {
          console.log("beforeUpdate hook: Hashing password change...");
          const salt = await bcrypt.genSalt(10);
          // Store the hash result temporarily
          const hashedPassword = await bcrypt.hash(user.password, salt);
          console.log(
            "beforeUpdate hook: Generated hash:",
            hashedPassword.substring(0, 15) + "..."
          ); // Log part of hash
          // Assign the hashed password back to the user instance's data value for password
          // This ensures the correct value is saved to the DB
          user.set("password", hashedPassword); // Use set() to ensure it's marked for update
          console.log(
            "beforeUpdate hook: Hashing assignment DONE via user.set()."
          ); // Add confirmation log
        } else if (user.changed("password")) {
          // This case handles if password was explicitly set to null or empty string
          console.log(
            "beforeUpdate hook: Password changed but is null/empty, skipping hash."
          );
        } else {
          // This case handles updates to other fields (like refreshToken, passwordResetToken)
          console.log(
            "beforeUpdate hook: Password not changed, skipping hash."
          );
        }
      },
    },
  }
);

module.exports = User;
