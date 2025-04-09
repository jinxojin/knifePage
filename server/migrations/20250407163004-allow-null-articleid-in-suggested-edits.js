"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log("Altering SuggestedEdits table to allow NULL for articleId...");
    await queryInterface.changeColumn("SuggestedEdits", "articleId", {
      type: Sequelize.INTEGER,
      allowNull: true, // <<< CHANGE TO TRUE
      // Keep existing references if they were defined correctly before
      references: {
        model: "Articles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE", // Or SET NULL if preferred when article deleted
    });
    console.log("articleId in SuggestedEdits now allows NULL.");
  },

  async down(queryInterface, Sequelize) {
    // Reverting this requires handling potential NULL values first if any exist
    console.log(
      "Attempting to revert articleId in SuggestedEdits to NOT NULL..."
    );
    // IMPORTANT: If there are rows with NULL articleId, this 'down' migration WILL FAIL.
    // You might need to delete suggestions where articleId IS NULL before running down,
    // or temporarily update them if possible.
    try {
      await queryInterface.sequelize.query(
        'DELETE FROM "SuggestedEdits" WHERE "articleId" IS NULL;'
      );
      console.log(
        "Deleted suggestions where articleId was NULL before reverting."
      );

      await queryInterface.changeColumn("SuggestedEdits", "articleId", {
        type: Sequelize.INTEGER,
        allowNull: false, // <<< CHANGE BACK TO FALSE
        references: { model: "Articles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
      console.log("articleId in SuggestedEdits reverted to NOT NULL.");
    } catch (error) {
      console.error(
        "Error reverting articleId constraint. There might still be NULL values or other issues.",
        error
      );
      // Throw error to stop the down migration if needed
      throw error;
    }
  },
};
