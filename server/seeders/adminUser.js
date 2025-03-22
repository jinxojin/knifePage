const User = require("../models/user");
const bcrypt = require("bcrypt");

async function seedAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ where: { username: "admin" } });

    if (!existingAdmin) {
      // Create admin user if it doesn't exist
      await User.create({
        username: "admin",
        passwordHash: await bcrypt.hash("adminpassword", 10),
      });
      console.log("Admin user created successfully");
    } else {
      console.log("Admin user already exists");
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}

module.exports = seedAdminUser;
