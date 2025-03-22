"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add a temporary column to store the new password format
    await queryInterface.addColumn("Users", "temp_password", {
      type: Sequelize.STRING,
      allowNull: true, // Allow null temporarily
    });

    // Copy the values from temp_password to password
    await queryInterface.sequelize.query(
      "UPDATE Users SET temp_password = password;"
    );

    // Remove the temporary column
    await queryInterface.removeColumn("Users", "password");

    await queryInterface.renameColumn("Users", "temp_password", "password");
  },

  async down(queryInterface, Sequelize) {
    // Add a temporary column to store the new password format
    await queryInterface.addColumn("Users", "temp_password", {
      type: Sequelize.STRING,
      allowNull: true, // Allow null temporarily
    });

    // Copy the values from  password to temp_password
    await queryInterface.sequelize.query(
      "UPDATE Users SET temp_password = password;"
    );

    // Remove the temporary column
    await queryInterface.removeColumn("Users", "password");

    await queryInterface.renameColumn("Users", "temp_password", "password");
  },
};
