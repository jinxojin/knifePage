"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- Step 1: Add email column, allowing nulls initially ---
    console.log("Adding email column (allowing nulls)...");
    await queryInterface.addColumn("Users", "email", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    });

    // --- Step 2: Update existing users with a default/placeholder email ---
    // !!! Use a hardcoded email here for reliability during migration !!!
    const defaultAdminEmail = "admin@example.com"; // <<< CHANGE THIS to a real email if desired
    // const defaultAdminEmail = process.env.ADMIN_EMAIL; // <<< REMOVE or COMMENT OUT this line
    console.log(
      `Updating existing admin user with email: ${defaultAdminEmail}...`
    );
    // Ensure the email value is not undefined before updating
    if (!defaultAdminEmail) {
      throw new Error(
        "Default admin email is missing in the migration script. Please set a hardcoded value."
      );
    }
    await queryInterface.bulkUpdate(
      "Users",
      { email: defaultAdminEmail }, // Set the hardcoded email
      { username: "admin" }
    );

    // --- Step 3: Now, ALTER the email column to disallow NULLs ---
    console.log("Altering email column to disallow nulls...");
    await queryInterface.changeColumn("Users", "email", {
      type: Sequelize.STRING,
      allowNull: false, // Enforce NOT NULL now
      unique: true,
      validate: {
        isEmail: true,
      },
    });

    // --- Step 4: Add needsPasswordChange column ---
    console.log("Adding needsPasswordChange column...");
    await queryInterface.addColumn("Users", "needsPasswordChange", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    // --- Step 5: Set needsPasswordChange=false for the existing admin user ---
    console.log("Updating existing admin user needsPasswordChange flag...");
    await queryInterface.bulkUpdate(
      "Users",
      { needsPasswordChange: false },
      { username: "admin" }
    );

    console.log("Migration completed successfully.");
  },

  async down(queryInterface, Sequelize) {
    // Revert in reverse order
    console.log("Reverting migration...");
    await queryInterface.removeColumn("Users", "needsPasswordChange");
    await queryInterface.removeColumn("Users", "email");
    console.log("Migration reverted.");
  },
};
