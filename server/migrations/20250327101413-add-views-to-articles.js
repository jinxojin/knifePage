'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Articles', 'views', { // Add the 'views' column
      type: Sequelize.INTEGER,
      allowNull: false,       // Don't allow null views
      defaultValue: 0         // Start counts at 0
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Articles', 'views'); // Revert by removing
  }
};
