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
    // Sequelize will automatically assume table name is 'SuggestedEdits'
    // tableName: 'SuggestedEdits' // Only needed if table name differs from plural model name
  }
);

// Associations will be defined in models/index.js
module.exports = SuggestedEdit;
