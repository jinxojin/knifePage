'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add new language-specific columns
    await queryInterface.addColumn('Articles', 'title_en', {
      type: Sequelize.STRING,
      allowNull: true, // Allow null initially, maybe make required later based on logic
    });
    await queryInterface.addColumn('Articles', 'title_rus', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Articles', 'title_mng', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Articles', 'content_en', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Articles', 'content_rus', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Articles', 'content_mng', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('Articles', 'excerpt_en', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Articles', 'excerpt_rus', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Articles', 'excerpt_mng', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // --- Data Migration: Copy old data to English fields ---
    console.log('Migrating data from old columns to _en columns...');
    await queryInterface.sequelize.query('UPDATE "Articles" SET "title_en" = "title"');
    await queryInterface.sequelize.query('UPDATE "Articles" SET "content_en" = "content"');
    await queryInterface.sequelize.query('UPDATE "Articles" SET "excerpt_en" = "excerpt"');
    console.log('Data migration complete.');
    // ------------------------------------------------------

    // Remove old single-language columns AFTER data migration
    console.log('Removing old columns...');
    await queryInterface.removeColumn('Articles', 'title');
    await queryInterface.removeColumn('Articles', 'content');
    await queryInterface.removeColumn('Articles', 'excerpt');
  },

  async down (queryInterface, Sequelize) {
    // Add back old columns
    await queryInterface.addColumn('Articles', 'title', {
      type: Sequelize.STRING,
      allowNull: false, // Assuming it was false before
    });
    await queryInterface.addColumn('Articles', 'content', {
      type: Sequelize.TEXT,
      allowNull: false, // Assuming it was false before
    });
    await queryInterface.addColumn('Articles', 'excerpt', {
      type: Sequelize.TEXT,
      allowNull: true, // Assuming it was true before
    });

    // --- Data Migration Back (if rolling back) ---
    console.log('Migrating data from _en columns back to old columns...');
    await queryInterface.sequelize.query('UPDATE "Articles" SET "title" = "title_en"');
    await queryInterface.sequelize.query('UPDATE "Articles" SET "content" = "content_en"');
    await queryInterface.sequelize.query('UPDATE "Articles" SET "excerpt" = "excerpt_en"');
    console.log('Reverse data migration complete.');
    // -------------------------------------------

    // Remove new language-specific columns AFTER migrating data back
    console.log('Removing new language columns...');
    await queryInterface.removeColumn('Articles', 'title_en');
    await queryInterface.removeColumn('Articles', 'title_rus');
    await queryInterface.removeColumn('Articles', 'title_mng');
    await queryInterface.removeColumn('Articles', 'content_en');
    await queryInterface.removeColumn('Articles', 'content_rus');
    await queryInterface.removeColumn('Articles', 'content_mng');
    await queryInterface.removeColumn('Articles', 'excerpt_en');
    await queryInterface.removeColumn('Articles', 'excerpt_rus');
    await queryInterface.removeColumn('Articles', 'excerpt_mng');
  }
};
