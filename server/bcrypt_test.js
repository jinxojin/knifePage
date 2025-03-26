const bcrypt = require("bcrypt");

async function testBcrypt() {
  const password = "?hutg4Y4jSh1d3hW3"; // The password to test

  // 1. Generate a NEW salt and hash.  This is what your createAdmin.js *should* be doing.
  const saltRounds = 10; // Use the correct salt rounds
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  console.log("--- Newly Generated Values ---");
  console.log("Generated Hash:", hashedPassword);

  // 2. Now, use these NEWLY GENERATED values for the comparison.

  const match = await bcrypt.compare(password, hashedPassword);

  console.log("--- Comparison with Generated Values ---");
  console.log("Password Match:", match); // MUST be true
}

testBcrypt();
