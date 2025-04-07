"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log("Creating SuggestedEdits table..."); // Log start
    await queryInterface.createTable("SuggestedEdits", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      articleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          // Foreign Key to Articles table
          model: "Articles", // Name of the target table (usually plural)
          key: "id", // Column in the target table
        },
        onUpdate: "CASCADE", // If article ID changes, update here
        onDelete: "CASCADE", // If article is deleted, delete its suggestions too
      },
      moderatorId: {
        type: Sequelize.INTEGER,
        allowNull: false, // Suggestion should always have an author
        references: {
          // Foreign Key to Users table
          model: "Users", // Name of the target table (usually plural)
          key: "id", // Column in the target table
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL", // Keep suggestion history if moderator is deleted, just nullify the link
      },
      // Store the entire proposed article object as JSONB
      proposedData: {
        type: Sequelize.JSONB, // Use JSONB for better performance/indexing in Postgres
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected"), // Use ENUM for defined states
        allowNull: false,
        defaultValue: "pending",
      },
      adminComments: {
        // Optional feedback from admin on rejection/approval
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"), // Optional: set default in DB
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"), // Optional: set default in DB
      },
    });
    console.log("SuggestedEdits table created.");

    // Optional: Add indexes for faster lookups on frequently queried columns
    console.log("Adding indexes to SuggestedEdits table...");
    await queryInterface.addIndex("SuggestedEdits", ["articleId"]);
    await queryInterface.addIndex("SuggestedEdits", ["moderatorId"]);
    await queryInterface.addIndex("SuggestedEdits", ["status"]);
    console.log("Indexes added.");
  },

  async down(queryInterface, Sequelize) {
    console.log("Dropping SuggestedEdits table..."); // Log revert start
    // Indexes are typically dropped automatically when table is dropped
    await queryInterface.dropTable("SuggestedEdits");
    console.log("SuggestedEdits table dropped.");
  },
};
