// server/createAdmin.js (Example - Run this ONCE)
const sequelize = require("./config/database");
const User = require("./models/user");

async function createAdmin() {
  try {
    await sequelize.sync(); // Make sure the User table exists

    // Check if an admin user already exists
    const existingAdmin = await User.findOne({ where: { username: "admin" } });
    if (existingAdmin) {
      console.log("Admin user already exists.");
      return;
    }

    const newAdmin = await User.create({
      username: "admin",
      passwordHash: "adminpassword", // The beforeCreate hook will hash it
    });
    console.log("Admin user created:", newAdmin.username);
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    sequelize.close(); // Close the database connection
  }
}

createAdmin();