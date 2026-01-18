// server/createAdmin.js
// Ensure environment variables are loaded if this script is run standalone
// Although NODE_ENV=production is set externally, dotenv helps if run manually
// without NODE_ENV being explicitly set for this single execution.
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: require("path").join(__dirname, ".env") });
}

const { sequelize, User } = require("./models");
const bcrypt = require("bcrypt");

async function createAdmin() {
  try {
    // Connect and authenticate database first
    await sequelize.authenticate();
    console.log("Database connection established for admin creation.");

    let user = await User.findOne({ where: { username: "admin" } });

    const adminPassword = "?hutg4Y4jSh1d3hW3"; // Define password once
    const adminEmail = "monknifethrowing@gmail.com"; // <-- DEFINE ADMIN EMAIL HERE
    // const hashedPassword = await bcrypt.hash(adminPassword, 10); // REMOVED: Model hook handles hashing

    if (user) {
      console.log(
        "Admin user already exists. Updating password and email..."
      );
      // Update properties on the instance and save to trigger hooks
      user.password = adminPassword;
      user.email = adminEmail;
      user.needsPasswordChange = false;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      
      await user.save(); 
      console.log("Admin password/email updated.");
    } else {
      console.log("Creating admin user...");
      const newAdmin = await User.create({
        username: "admin",
        email: adminEmail, 
        password: adminPassword, // Pass plaintext
        role: "admin", 
        needsPasswordChange: false, 
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
