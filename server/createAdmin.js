// server/createAdmin.js
const { sequelize } = require("./config/database");
const User = require("./models/user");
const bcrypt = require("bcrypt"); // USE BCRYPT

async function createAdmin() {
  try {
    // Do NOT call sequelize.sync() here!  Let app.js handle database setup.

    let user = await User.findOne({ where: { username: "admin" } });

    if (user) {
      console.log("Admin user already exists. Updating password...");
      // Update the password, using bcrypt.
      const hashedPassword = await bcrypt.hash("?hutg4Y4jSh1d3hW3", 10); // USE BCRYPT
      await User.update(
        { password: hashedPassword },
        { where: { username: "admin" } }
      );
      console.log("Admin password updated.");
    } else {
      console.log("Creating admin user...");
      const hashedPassword = await bcrypt.hash("?hutg4Y4jSh1d3hW3", 10); // USE BCRYPT
      const newAdmin = await User.create({
        username: "admin",
        password: hashedPassword,
      });
      console.log("Admin user created:", newAdmin.username);
    }
  } catch (error) {
    console.error("Error creating/updating admin user:", error);
  }
  // NO FINALLY BLOCK - Let app.js manage the connection.
}

createAdmin();
