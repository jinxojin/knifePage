const bcrypt = require("bcrypt");

async function testBcrypt() {
  const password = "?hutg4Y4jShi1d3hW3"; // The password to test

  // 1. Generate a NEW salt and hash.  This is what your createAdmin.js *should* be doing.
  const saltRounds = 10; // Use the correct salt rounds
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  console.log("--- Newly Generated Values ---");
  console.log("Generated Hash:", hashedPassword);

  // 2. Now, use these NEWLY GENERATED values for the comparison.

  const match = await bcrypt.compare(password, hashedPassword);

  console.log("--- Comparison with Generated Values ---");
  console.log("Password Match:", match); // MUST be true

  // --- Uncomment this section AFTER you've run createAdmin.js and copied the values ---

  //   const dbPassword =
  //     "$2b$10$4crflTzfWEypgyN78KgEcuUOgbZ4.Ugc.C8Jf8k/QYqNeIu3GGeAm"; // From server log: "Extracted Key (Hash)"

  //   const matchDb = await bcrypt.compare(password, dbPassword);

  //   console.log("--- Comparison with Database Values ---");
  //   console.log("Hashed Buffer (from entered password):", hashedPassword);
  //   console.log("Password Match (DB):", matchDb);

  // --- End Database Test ---
}

testBcrypt();
