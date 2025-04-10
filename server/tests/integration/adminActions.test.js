// server/tests/integration/adminActions.test.js
const request = require("supertest");
const { sequelize, User } = require("../../models");
const Sequelize = require("sequelize");
const { Op } = Sequelize;
const app = require("../../app");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const agent = request.agent(app);
let csrfToken = null;

const adminUsername = "adminActionTester";
const adminPassword = "password123ADMIN!";
let adminUserId = null;
let adminToken = null;

// Base username for duplicate tests
const baseModeratorUsername = "modTargetForDupTest";

// --- Test Setup ---
beforeAll(async () => {
  try {
    const res = await agent.get("/api/csrf-token");
    csrfToken = res.body.csrfToken;
    if (!csrfToken) throw new Error("CSRF token fetch failed");
    console.log("CSRF token fetched for admin actions tests:", csrfToken);
  } catch (error) {
    console.error("FATAL: Could not fetch CSRF token:", error);
    throw error;
  }
  console.log("Running beforeAll setup...");
  await User.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  }); // Start clean
  const adminUser = await User.create({
    username: adminUsername,
    email: "adminactiontester@example.com",
    password: adminPassword,
    role: "admin",
    needsPasswordChange: false, // Ensure test admin doesn't need change
  });
  adminUserId = adminUser.id;
  if (!adminUserId)
    throw new Error("Failed to create admin user or get ID in beforeAll");
  console.log(`Admin user ${adminUsername} (ID: ${adminUserId}) created.`);
  const loginRes = await agent
    .post("/api/admin/login")
    .set("x-csrf-token", csrfToken)
    .send({ username: adminUsername, password: adminPassword });
  if (loginRes.statusCode !== 200 || !loginRes.body.accessToken) {
    console.error("Admin login failed in beforeAll:", loginRes.body);
    throw new Error("Could not log in as admin in beforeAll setup.");
  }
  adminToken = loginRes.body.accessToken;
  console.log("Logged in as admin, token obtained.");
  console.log("Finished beforeAll setup.");
});

beforeEach(async () => {
  console.log("--- Test Start ---");
  // Aggressive cleanup: Remove all users EXCEPT the persistent admin before each test
  try {
    if (adminUserId) {
      await User.destroy({ where: { id: { [Op.ne]: adminUserId } } });
      console.log(`beforeEach: Cleaned all non-admin users.`);
    } else {
      console.error(
        "beforeEach: adminUserId is null, performing broader cleanup!"
      );
      await User.destroy({ where: {}, truncate: true });
    }
  } catch (e) {
    console.error("Error during beforeEach cleanup:", e);
  }
});

afterAll(async () => {
  // Final cleanup
  await User.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await sequelize.close();
  console.log("DB connection closed after admin actions tests.");
});

// --- Test Suites ---
describe("User Management (/api/admin/users)", () => {
  describe("POST /api/admin/users (Create Moderator)", () => {
    it("should successfully create a new moderator", async () => {
      if (!csrfToken || !adminToken)
        return pending("CSRF/Auth token unavailable");
      const uniqueSuffix = crypto.randomBytes(4).toString("hex");
      const newUsername = `newModTest_${uniqueSuffix}`;
      const newEmail = `newmod-${uniqueSuffix}@example.com`;
      console.log(
        `[TEST][Success Create] Attempting to create user: ${newUsername}`
      );
      let dbUser; // To find the user later for potential cleanup if needed

      try {
        const res = await agent
          .post("/api/admin/users")
          .set("Authorization", `Bearer ${adminToken}`)
          .set("x-csrf-token", csrfToken)
          .send({ username: newUsername, email: newEmail });
        console.log("[TEST][Success Create] Response Status:", res.statusCode);
        if (res.statusCode !== 201) {
          console.error(
            "[TEST][Success Create] Response Body:",
            JSON.stringify(res.body, null, 2)
          );
        }

        expect(res.statusCode).toEqual(201);
        // === Check the now added message ===
        expect(res.body.message).toMatch(/moderator created successfully/i);
        // =================================
        expect(res.body).toHaveProperty("userId");
        expect(res.body).toHaveProperty("username", newUsername);
        expect(res.body).toHaveProperty("email", newEmail);
        expect(res.body).toHaveProperty("temporaryPassword");

        dbUser = await User.findByPk(res.body.userId);
        expect(dbUser).not.toBeNull();
        if (dbUser) {
          expect(dbUser.username).toEqual(newUsername);
          expect(dbUser.role).toEqual("moderator");
          expect(dbUser.needsPasswordChange).toBe(true); // New mods *should* need change
        }
      } finally {
        // Cleanup handled by beforeEach, but added safety destroy just in case
        if (dbUser) await dbUser.destroy();
        else await User.destroy({ where: { username: newUsername } });
        console.log(
          `[TEST][Success Create] Cleanup attempt finished for ${newUsername}.`
        );
      }
    });

    it("should return 400 for validation errors (e.g., short username)", async () => {
      if (!csrfToken || !adminToken)
        return pending("CSRF/Auth token unavailable");
      console.log(`[TEST] Attempting create with short username`);
      const res = await agent
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-csrf-token", csrfToken)
        .send({ username: "a", email: "valid@example.com" });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/validation error/i);
      expect(res.body.errors.some((e) => e.path === "username")).toBe(true);
    });

    it("should return 400 for invalid email", async () => {
      if (!csrfToken || !adminToken)
        return pending("CSRF/Auth token unavailable");
      console.log(`[TEST] Attempting create with invalid email`);
      const res = await agent
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-csrf-token", csrfToken)
        .send({ username: "validUsername", email: "not-an-email" });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/validation error/i);
      expect(res.body.errors.some((e) => e.path === "email")).toBe(true);
    });

    it("should return 400 for duplicate username", async () => {
      if (!csrfToken || !adminToken)
        return pending("CSRF/Auth token unavailable");
      let conflictingUser;
      try {
        conflictingUser = await User.create({
          username: baseModeratorUsername,
          email: "unique-email1@example.com",
          password: "password",
          role: "moderator",
          needsPasswordChange: false, // Set explicitly for clarity
        });
        console.log(
          `[TEST][Duplicate User] Attempting create with duplicate username: ${baseModeratorUsername}`
        );
        const res = await agent
          .post("/api/admin/users")
          .set("Authorization", `Bearer ${adminToken}`)
          .set("x-csrf-token", csrfToken)
          .send({
            username: baseModeratorUsername,
            email: "newunique@example.com",
          });
        console.log("[TEST][Duplicate User] Response Status:", res.statusCode);
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toMatch(/validation error/i);
        expect(res.body.errors).toBeInstanceOf(Array);
        expect(
          res.body.errors.some(
            (e) => e.path === "username" && e.msg === "Username already in use"
          )
        ).toBe(true);
      } finally {
        if (conflictingUser) await conflictingUser.destroy();
      }
    });

    it("should return 400 for duplicate email", async () => {
      if (!csrfToken || !adminToken)
        return pending("CSRF/Auth token unavailable");
      const duplicateTestEmail = `dupEmailTest${Date.now()}@example.com`;
      let conflictingUser;
      let secondUserAttemptedUsername = "newUniqueUsernameForEmailTest";
      try {
        conflictingUser = await User.create({
          username: "someUniqueUserForEmailTest",
          email: duplicateTestEmail,
          password: "password",
          role: "moderator",
          needsPasswordChange: false, // Set explicitly
        });
        console.log(
          `[TEST][Duplicate Email] Attempting create with duplicate email: ${duplicateTestEmail}`
        );
        const res = await agent
          .post("/api/admin/users")
          .set("Authorization", `Bearer ${adminToken}`)
          .set("x-csrf-token", csrfToken)
          .send({
            username: secondUserAttemptedUsername,
            email: duplicateTestEmail,
          });
        console.log("[TEST][Duplicate Email] Response Status:", res.statusCode);
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toMatch(/validation error/i);
        expect(res.body.errors).toBeInstanceOf(Array);
        expect(
          res.body.errors.some(
            (e) => e.path === "email" && e.msg === "Email already in use"
          )
        ).toBe(true);
      } finally {
        if (conflictingUser) await conflictingUser.destroy();
        await User.destroy({
          where: { username: secondUserAttemptedUsername },
        });
      }
    });

    it("should return 403 if requested by non-admin", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const tempModPassword = "tempModPassword123";
      let tempMod;
      try {
        // === FIX: Create user with needsPasswordChange: false ===
        tempMod = await User.create({
          username: "tempNonAdmin",
          email: "tempNonAdmin@example.com",
          password: tempModPassword,
          role: "moderator",
          needsPasswordChange: false, // Allow login for test
        });
        // =======================================================
        console.log(`[TEST] Attempting create as moderator ID: ${tempMod.id}`);
        const modLoginRes = await agent
          .post("/api/admin/login")
          .set("x-csrf-token", csrfToken)
          .send({ username: tempMod.username, password: tempModPassword });

        // === Check login response BEFORE throwing ===
        if (modLoginRes.statusCode !== 200) {
          console.error(
            "Moderator login failed unexpectedly:",
            modLoginRes.status,
            modLoginRes.body
          );
          // Throw error here if login *still* fails, indicating another issue
          throw new Error(
            `Moderator login failed with status ${modLoginRes.status}`
          );
        }
        // ===========================================

        const modToken = modLoginRes.body.accessToken;
        const res = await agent
          .post("/api/admin/users")
          .set("Authorization", `Bearer ${modToken}`)
          .set("x-csrf-token", csrfToken)
          .send({ username: "anotherNewMod", email: "another@example.com" });
        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toMatch(/admin role required/i);
      } finally {
        if (tempMod) await tempMod.destroy();
      }
    });
  });

  describe("DELETE /api/admin/users/:userId", () => {
    let moderatorToDeleteId;
    let moderatorToDeleteUsername;
    const moderatorPassword = "passwordToDelete"; // Consistent password

    beforeEach(async () => {
      moderatorToDeleteUsername = `modToDelete_${crypto
        .randomBytes(3)
        .toString("hex")}`;
      const moderatorToDeleteEmail = `${moderatorToDeleteUsername}@example.com`;
      await User.destroy({ where: { username: moderatorToDeleteUsername } });
      // === FIX: Create user with needsPasswordChange: false ===
      const mod = await User.create({
        username: moderatorToDeleteUsername,
        email: moderatorToDeleteEmail,
        password: moderatorPassword,
        role: "moderator",
        needsPasswordChange: false, // Set to false for test login
      });
      // ======================================================
      moderatorToDeleteId = mod.id;
      console.log(
        `DELETE beforeEach: Created moderator ID ${moderatorToDeleteId} (${moderatorToDeleteUsername})`
      );
    });

    it("should successfully delete an existing moderator", async () => {
      if (!csrfToken || !adminToken || !moderatorToDeleteId)
        return pending("Tokens/ModID unavailable");
      console.log(
        `[TEST][Success Delete] Attempting to delete moderator ID: ${moderatorToDeleteId}`
      );
      const res = await agent
        .delete(`/api/admin/users/${moderatorToDeleteId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-csrf-token", csrfToken);
      if (res.statusCode !== 204) {
        console.error(`Delete failed: ${res.status}`, res.body);
      }
      expect(res.statusCode).toEqual(204);
      const dbUser = await User.findByPk(moderatorToDeleteId);
      expect(dbUser).toBeNull();
      moderatorToDeleteId = null; // Prevent cleanup in other tests
    });

    it("should return 404 when trying to delete a non-existent user", async () => {
      if (!csrfToken || !adminToken) return pending("Tokens unavailable");
      const nonExistentId = 999999;
      console.log(
        `[TEST] Attempting to delete non-existent user ID: ${nonExistentId}`
      );
      const res = await agent
        .delete(`/api/admin/users/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-csrf-token", csrfToken);
      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toMatch(/user not found/i);
    });

    it("should return 403 when admin tries to delete themselves", async () => {
      if (!csrfToken || !adminToken || !adminUserId)
        return pending("Tokens/AdminID unavailable");
      console.log(
        `[TEST] Attempting to delete self (admin ID: ${adminUserId})`
      );
      const res = await agent
        .delete(`/api/admin/users/${adminUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-csrf-token", csrfToken);
      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toMatch(/cannot delete their own account/i);
    });

    it("should return 403 when admin tries to delete another admin", async () => {
      if (!csrfToken || !adminToken) return pending("Tokens unavailable");
      console.log(`[TEST] Attempting to delete another admin`);
      let anotherAdmin;
      try {
        const uniqueSuffix = crypto.randomBytes(2).toString("hex");
        anotherAdmin = await User.create({
          username: `anotherAdminToDelete_${uniqueSuffix}`,
          email: `anotheradmin${uniqueSuffix}@example.com`,
          password: "password",
          role: "admin",
          needsPasswordChange: false, // For consistency
        });
        console.log(`Created temporary admin ID: ${anotherAdmin.id}`);
        const res = await agent
          .delete(`/api/admin/users/${anotherAdmin.id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .set("x-csrf-token", csrfToken);
        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toMatch(
          /cannot delete another administrator account/i
        );
      } finally {
        if (anotherAdmin) await anotherAdmin.destroy();
      }
    });

    it("should return 403 if requested by non-admin", async () => {
      if (!csrfToken || !moderatorToDeleteId)
        return pending("Tokens/ModID unavailable");
      console.log(
        `[TEST] Attempting delete (ID: ${moderatorToDeleteId}) as moderator ${moderatorToDeleteUsername}`
      );
      let modToken;
      let loginSucceeded = false;
      try {
        // Login attempt for the moderator created in beforeEach (with needsPasswordChange: false)
        const modLoginRes = await agent
          .post("/api/admin/login")
          .set("x-csrf-token", csrfToken)
          .send({
            username: moderatorToDeleteUsername,
            password: moderatorPassword,
          });

        if (modLoginRes.statusCode !== 200) {
          console.error(
            "Moderator login failed unexpectedly (non-admin delete test):",
            modLoginRes.status,
            modLoginRes.body
          );
        } else {
          modToken = modLoginRes.body.accessToken;
          loginSucceeded = true;
        }
      } catch (e) {
        console.error("Exception during moderator login:", e);
      }

      // This assertion should now pass because login should succeed
      expect(loginSucceeded).toBe(true);
      if (!loginSucceeded) return; // Skip rest of test if login failed

      // Attempt the delete action using the moderator's token
      const res = await agent
        .delete(`/api/admin/users/${moderatorToDeleteId}`)
        .set("Authorization", `Bearer ${modToken}`)
        .set("x-csrf-token", csrfToken);
      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toMatch(/admin role required/i);
    });
  });
});
