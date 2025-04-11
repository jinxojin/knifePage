// server/createAdmin.js
// Ensure environment variables are loaded if this script is run standalone
// Although NODE_ENV=production is set externally, dotenv helps if run manually
// without NODE_ENV being explicitly set for this single execution.
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: require("path").join(__dirname, ".env") });
}

const { sequelize } = require("./config/database");
const User = require("./models/user");
const bcrypt = require("bcrypt");

async function createAdmin() {
  try {
    // Connect and authenticate database first
    await sequelize.authenticate();
    console.log("Database connection established for admin creation.");

    let user = await User.findOne({ where: { username: "admin" } });

    const adminPassword = "?hutg4Y4jSh1d3hW3"; // Define password once
    const adminEmail = "monknifethrowing@gmail.com"; // <-- DEFINE ADMIN EMAIL HERE
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    if (user) {
      console.log(
        "Admin user already exists. Updating password and email (if needed)..."
      );
      await User.update(
        {
          password: hashedPassword,
          email: adminEmail, // Ensure email is set
          needsPasswordChange: false, // Ensure admin doesn't need reset
        },
        { where: { username: "admin" } }
      );
      console.log("Admin password/email updated.");
    } else {
      console.log("Creating admin user...");
      const newAdmin = await User.create({
        username: "admin",
        email: adminEmail, // <-- ADD EMAIL HERE
        password: hashedPassword,
        role: "admin", // Explicitly set role
        needsPasswordChange: false, // <-- Set initial state
      });
      console.log("Admin user created:", newAdmin.username);
    }
  } catch (error) {
    console.error("Error creating/updating admin user:", error);
  } finally {
    // Close the database connection when done
    await sequelize.close();
    console.log("Database connection closed for admin creation.");
  }
}

createAdmin();
