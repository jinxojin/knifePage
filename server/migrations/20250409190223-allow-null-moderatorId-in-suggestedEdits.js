"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      console.log(
        "Starting transaction to modify SuggestedEdits.moderatorId..."
      );

      // 1. Remove the existing foreign key constraint
      // Default constraint name is usually TableName_columnName_fkey
      // Double-check constraint name in your DB if this fails
      const constraintName = "SuggestedEdits_moderatorId_fkey";
      console.log(`Removing constraint: ${constraintName}...`);
      await queryInterface.removeConstraint("SuggestedEdits", constraintName, {
        transaction,
      });
      console.log("Constraint removed.");

      // 2. Change the column to allow NULL
      console.log("Changing moderatorId column to allow NULLs...");
      await queryInterface.changeColumn(
        "SuggestedEdits",
        "moderatorId",
        {
          type: Sequelize.INTEGER,
          allowNull: true, // <<< SET TO TRUE
        },
        { transaction }
      );
      console.log("Column moderatorId changed to allow NULLs.");

      // 3. Re-add the foreign key constraint with ON DELETE SET NULL
      console.log(
        `Re-adding constraint ${constraintName} with ON DELETE SET NULL...`
      );
      await queryInterface.addConstraint("SuggestedEdits", {
        fields: ["moderatorId"],
        type: "foreign key",
        name: constraintName, // Re-use the same name or let DB generate one
        references: {
          table: "Users",
          field: "id",
        },
        onDelete: "SET NULL", // <<< ENSURE THIS IS SET NULL
        onUpdate: "CASCADE",
        transaction: transaction,
      });
      console.log("Constraint re-added.");

      await transaction.commit();
      console.log("Transaction committed successfully.");
    } catch (error) {
      console.error("Error modifying moderatorId:", error);
      await transaction.rollback();
      console.error("Transaction rolled back.");
      throw error; // Re-throw error to fail the migration
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverting this is complex and requires similar steps in reverse
    // For now, focus on getting 'up' to work. A simple 'down' might be:
    const transaction = await queryInterface.sequelize.transaction();
    try {
      console.log(
        "Attempting to revert moderatorId changes (removing constraint, changing column, re-adding constraint)..."
      );
      const constraintName = "SuggestedEdits_moderatorId_fkey";

      // Delete rows where moderatorId IS NULL first (REQUIRED before making NOT NULL)
      await queryInterface.sequelize.query(
        'DELETE FROM "SuggestedEdits" WHERE "moderatorId" IS NULL;',
        { transaction }
      );
      console.log("Deleted rows with NULL moderatorId.");

      await queryInterface.removeConstraint("SuggestedEdits", constraintName, {
        transaction,
      });
      await queryInterface.changeColumn(
        "SuggestedEdits",
        "moderatorId",
        {
          type: Sequelize.INTEGER,
          allowNull: false, // <<< SET BACK TO FALSE
        },
        { transaction }
      );
      await queryInterface.addConstraint("SuggestedEdits", {
        fields: ["moderatorId"],
        type: "foreign key",
        name: constraintName,
        references: { table: "Users", field: "id" },
        onDelete: "SET NULL", // Or original if different
        onUpdate: "CASCADE",
        transaction: transaction,
      });
      await transaction.commit();
      console.log("Reverted moderatorId changes.");
    } catch (error) {
      console.error("Error reverting moderatorId changes:", error);
      await transaction.rollback();
      throw error;
    }
  },
};
