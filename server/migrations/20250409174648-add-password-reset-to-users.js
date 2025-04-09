"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log("Adding password reset columns to Users table...");
    await queryInterface.addColumn("Users", "passwordResetToken", {
      type: Sequelize.STRING,
      allowNull: true, // Token is null when not resetting
    });
    await queryInterface.addColumn("Users", "passwordResetExpires", {
      type: Sequelize.DATE, // Or Sequelize.TIMESTAMP
      allowNull: true, // Expires is null when not resetting
    });
    // Add an index for faster lookups by token (important!)
    // Note: Using Op here inside migration requires Sequelize object access
    const Op = Sequelize.Op;
    await queryInterface.addIndex("Users", ["passwordResetToken"], {
      unique: true, // Tokens should be unique when set
      where: {
        // Only index non-null tokens (Postgres specific)
        passwordResetToken: {
          [Op.ne]: null, // Use Op here
        },
      },
      name: "users_password_reset_token_idx", // Explicit index name
    });
    console.log("Password reset columns and index added.");
  },

  async down(queryInterface, Sequelize) {
    console.log(
      "Removing password reset columns and index from Users table..."
    );
    // Remove index first using its explicit name
    await queryInterface.removeIndex("Users", "users_password_reset_token_idx");
    await queryInterface.removeColumn("Users", "passwordResetExpires");
    await queryInterface.removeColumn("Users", "passwordResetToken");
    console.log("Password reset columns and index removed.");
  },
};
