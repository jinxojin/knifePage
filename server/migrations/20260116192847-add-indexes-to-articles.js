"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add index for category lookups
    await queryInterface.addIndex("Articles", ["category"], {
      name: "articles_category_idx",
    });

    // Add index for status lookups (crucial for public view filtering)
    await queryInterface.addIndex("Articles", ["status"], {
      name: "articles_status_idx",
    });

    // Add composite index for common public queries (category + status + date)
    await queryInterface.addIndex("Articles", ["category", "status", "createdAt"], {
      name: "articles_public_list_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("Articles", "articles_category_idx");
    await queryInterface.removeIndex("Articles", "articles_status_idx");
    await queryInterface.removeIndex("Articles", "articles_public_list_idx");
  },
};