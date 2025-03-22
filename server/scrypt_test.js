const { scryptSync, randomBytes, timingSafeEqual } = require("crypto");

async function testScrypt() {
  const password = "adminpassword"; // The password to test
  const salt = randomBytes(16).toString("hex");
  const hashedPassword = scryptSync(password, salt, 64).toString("hex");
  const storedPassword = `${salt}:${hashedPassword}`;

  const [saltDb, key] = storedPassword.split(":");
  const hashedBuffer = scryptSync(password, saltDb, 64);

  const keyBuffer = Buffer.from(key, "hex");
  const match = timingSafeEqual(hashedBuffer, keyBuffer);

  if (match) {
    console.log("Passwords match!");
  } else {
    console.log("Passwords DO NOT match.");
  }
}

testScrypt();
