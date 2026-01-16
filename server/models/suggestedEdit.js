// server/models/suggestedEdit.js
const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../config/database");

class SuggestedEdit extends Model {}

SuggestedEdit.init(
  {
    // id, createdAt, updatedAt are handled by Sequelize automatically
    articleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    moderatorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    proposedData: {
      type: DataTypes.JSONB, // Match migration type
      allowNull: false,
      // Add validation if needed (e.g., check if it's an object)
      // validate: {
      //   isObject(value) {
      //     if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      //       throw new Error('Proposed data must be an object.');
      //     }
      //   }
      // }
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"), // Match migration type
      allowNull: false,
      defaultValue: "pending",
    },
    adminComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "SuggestedEdit",
    hooks: {
      beforeCreate: (suggestion) => {
        if (suggestion.proposedData) {
          const { sanitize } = require("../utils/sanitizer");
          const fieldsToSanitize = [
            "content_en",
            "content_rus",
            "content_mng",
            "excerpt_en",
            "excerpt_rus",
            "excerpt_mng",
          ];
          fieldsToSanitize.forEach((field) => {
            if (suggestion.proposedData[field]) {
              suggestion.proposedData[field] = sanitize(
                suggestion.proposedData[field]
              );
            }
          });
        }
      },
      beforeUpdate: (suggestion) => {
        if (suggestion.changed("proposedData") && suggestion.proposedData) {
          const { sanitize } = require("../utils/sanitizer");
          const fieldsToSanitize = [
            "content_en",
            "content_rus",
            "content_mng",
            "excerpt_en",
            "excerpt_rus",
            "excerpt_mng",
          ];
          fieldsToSanitize.forEach((field) => {
            if (suggestion.proposedData[field]) {
              suggestion.proposedData[field] = sanitize(
                suggestion.proposedData[field]
              );
            }
          });
        }
      },
    },
  }
);

// Associations will be defined in models/index.js
module.exports = SuggestedEdit;
