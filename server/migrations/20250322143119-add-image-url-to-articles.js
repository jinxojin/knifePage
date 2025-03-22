// server/migrations/xxxxxxxxx-add-image-url-to-articles.js (Example)
"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Articles", "imageUrl", {
      type: Sequelize.STRING,
      allowNull: true, // Or false, depending on your requirements
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Articles", "imageUrl");
  },
};
