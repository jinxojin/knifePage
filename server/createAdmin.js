// server/createAdmin.js
const { sequelize } = require("./config/database");
const User = require("./models/user");
const { scryptSync, randomBytes } = require("crypto"); // Import scryptSync

async function createAdmin() {
  try {
    // await sequelize.sync(); // Ensure tables exist // REMOVE THIS

    const existingAdmin = await User.findOne({ where: { username: "admin" } });

    if (existingAdmin) {
      console.log("Admin user already exists. Updating password...");
      const salt = randomBytes(16).toString("hex"); // Generate salt
      const hashedPassword = scryptSync("adminpassword", salt, 64).toString(
        "hex"
      ); // Hash
      existingAdmin.password = `${salt}:${hashedPassword}`; // Store salt:hash
      await existingAdmin.save();
      console.log("Admin password updated.");
    } else {
      console.log("Creating admin user...");
      const salt = randomBytes(16).toString("hex"); // Generate salt
      const hashedPassword = scryptSync("adminpassword", salt, 64).toString(
        "hex"
      ); // Hash
      const newAdmin = await User.create({
        username: "admin",
        password: `${salt}:${hashedPassword}`, // Store salt:hash
      });
      console.log("Admin user created:", newAdmin.username);
    }
  } catch (error) {
    console.error("Error creating/updating admin user:", error);
  }
  // REMOVED FINALLY BLOCK
}
createAdmin();
