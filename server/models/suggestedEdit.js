// server/models/suggestedEdit.js
const { DataTypes, Model } = require("sequelize");

module.exports = (sequelize) => {
  class SuggestedEdit extends Model {}

  SuggestedEdit.init(
    {
      articleId: { type: DataTypes.INTEGER, allowNull: true },
      moderatorId: { type: DataTypes.INTEGER, allowNull: true },
      proposedData: { type: DataTypes.JSONB, allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      adminComments: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "SuggestedEdit",
      hooks: {
        beforeCreate: (suggestion) => {
          if (suggestion.proposedData) {
            const { sanitize } = require("../utils/sanitizer");
            const fieldsToSanitize = ["content_en", "content_rus", "content_mng", "excerpt_en", "excerpt_rus", "excerpt_mng"];
            fieldsToSanitize.forEach((field) => {
              if (suggestion.proposedData[field]) {
                suggestion.proposedData[field] = sanitize(suggestion.proposedData[field]);
              }
            });
          }
        },
        beforeUpdate: (suggestion) => {
          if (suggestion.changed("proposedData") && suggestion.proposedData) {
            const { sanitize } = require("../utils/sanitizer");
            const fieldsToSanitize = ["content_en", "content_rus", "content_mng", "excerpt_en", "excerpt_rus", "excerpt_mng"];
            fieldsToSanitize.forEach((field) => {
              if (suggestion.proposedData[field]) {
                suggestion.proposedData[field] = sanitize(suggestion.proposedData[field]);
              }
            });
          }
        },
      },
    }
  );

  return SuggestedEdit;
};