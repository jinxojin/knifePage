// server/migrations/YYYYMMDDHHMMSS-add-excerpt-to-articles.js
"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn("Articles", "excerpt", {
      // Table name, new column name
      type: Sequelize.TEXT, // Use TEXT for flexibility, allows longer summaries
      // Or use Sequelize.STRING(500) if you want a strict DB limit matching validation
      allowNull: true, // Make the excerpt optional
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn("Articles", "excerpt"); // Revert by removing the column
  },
};
