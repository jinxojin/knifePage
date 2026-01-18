const { Model, DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const logger = require("../utils/logger");

module.exports = (sequelize) => {
  class User extends Model {}

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("admin", "moderator"),
        defaultValue: "moderator",
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      needsPasswordChange: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Fields for password reset
      passwordResetToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      passwordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      hooks: {
        beforeCreate: async (user) => {
          logger.debug("beforeCreate hook: Hashing password...");
          user.password = await bcrypt.hash(user.password, 10);
          logger.debug("beforeCreate hook: Hashing DONE.");
        },
        beforeUpdate: async (user) => {
          const changedFields = user.changed();
          logger.debug("beforeUpdate hook: User ID:", user.id);
          logger.debug("beforeUpdate hook: Changed fields:", changedFields);
          logger.debug(
            "beforeUpdate hook: user.password value exists:",
            !!user.password
          );
          if (user.changed("password")) {
            logger.debug(
              "beforeUpdate hook: password field IS in user.changed()"
            );
            logger.debug("beforeUpdate hook: Hashing password change...");
            user.password = await bcrypt.hash(user.password, 10);
            logger.debug(
              "beforeUpdate hook: Password hashed. New hash starts with:",
              user.password.substring(0, 10)
            );
          } else {
            logger.debug(
              "beforeUpdate hook: password field NOT in user.changed()"
            );
          }
          logger.debug(
            "beforeUpdate hook: needsPasswordChange:",
            user.needsPasswordChange
          );
          logger.debug(
            "beforeUpdate hook: needsPasswordChange changed:",
            user.changed("needsPasswordChange")
          );
        },
      },
    }
  );

  return User;
};