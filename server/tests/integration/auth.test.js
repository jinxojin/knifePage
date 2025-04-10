// server/tests/integration/auth.test.js
const request = require("supertest");
const { sequelize, User } = require("../../models");
const app = require("../../app"); // Import the configured app instance
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken"); // Import JWT to inspect tokens if needed
const crypto = require("crypto"); // Import crypto for test token generation

// Create an agent to persist cookies
const agent = request.agent(app);

// Variable to store CSRF token for tests
let csrfToken;

// --- Test Setup ---
beforeAll(async () => {
  // Fetch CSRF token once for all tests in this file
  try {
    const res = await agent.get("/api/csrf-token"); // <-- Use agent to get token
    csrfToken = res.body.csrfToken; // Store the token
    if (!csrfToken) {
      throw new Error("CSRF token not received from /api/csrf-token");
    }
    console.log("CSRF token fetched for auth tests:", csrfToken);
  } catch (error) {
    console.error("FATAL: Could not fetch CSRF token for auth tests.", error);
    throw error; // Stop tests if CSRF fetch fails
  }
});

beforeEach(async () => {
  // Clean and setup user before each test
  await User.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  // Create user with PLAINTEXT password, hook will hash it
  await User.create({
    username: "testadmin",
    email: "testadmin@example.com",
    password: "testpassword123", // Pass plaintext
    role: "admin",
    needsPasswordChange: false, // Ensure test admin can login
  });
  console.log("Auth Test: Test admin user created/reset for test.");
});

afterAll(async () => {
  await sequelize.close();
  console.log("DB connection closed after auth tests.");
});

// --- Tests ---
describe("Authentication API (/api/admin)", () => {
  // --- Login Tests ---
  describe("POST /api/admin/login", () => {
    it("should login successfully with correct credentials", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const res = await agent
        .post("/api/admin/login")
        .set("x-csrf-token", csrfToken)
        .send({ username: "testadmin", password: "testpassword123" });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.headers["content-type"]).toMatch(/json/);
    });
    it("should fail login with incorrect password", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const res = await agent
        .post("/api/admin/login")
        .set("x-csrf-token", csrfToken)
        .send({ username: "testadmin", password: "wrongpassword" });
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toMatch(/invalid credentials/i);
      expect(res.headers["content-type"]).toMatch(/json/);
    });
    it("should fail login with non-existent username", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const res = await agent
        .post("/api/admin/login")
        .set("x-csrf-token", csrfToken)
        .send({ username: "nosuchuser", password: "testpassword123" });
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toMatch(/invalid credentials/i);
      expect(res.headers["content-type"]).toMatch(/json/);
    });
    it("should return 400 if validation fails (e.g., missing password)", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const res = await agent
        .post("/api/admin/login")
        .set("x-csrf-token", csrfToken)
        .send({ username: "testadmin" });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/validation error/i);
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(
        res.body.errors.some(
          (e) => e.param === "password" || e.path === "password"
        )
      ).toBe(true);
      expect(res.headers["content-type"]).toMatch(/json/);
    });
    // TODO: Add test case for needsPasswordChange scenario
  });

  // --- Refresh Token Tests ---
  describe("POST /api/admin/refresh", () => {
    // Helper to perform login and get tokens for refresh tests
    async function getTokens() {
      if (!csrfToken) throw new Error("CSRF token missing in getTokens helper");
      const loginRes = await agent
        .post("/api/admin/login")
        .set("x-csrf-token", csrfToken)
        .send({ username: "testadmin", password: "testpassword123" });
      if (loginRes.statusCode !== 200) {
        console.error("Login failed within getTokens helper:", loginRes.body);
        throw new Error("Login failed during test setup");
      }
      return loginRes.body; // { accessToken, refreshToken }
    }

    it("should refresh successfully with a valid refresh token", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const tokens = await getTokens(); // Login to get a valid refresh token

      // === FIX: Introduce a delay slightly longer than 1 second ===
      console.log("Waiting 1.1 seconds before refresh...");
      await new Promise((resolve) => setTimeout(resolve, 1100)); // Wait 1100 ms
      // ===========================================================

      const refreshRes = await agent
        .post("/api/admin/refresh")
        .set("x-csrf-token", csrfToken) // Refresh also needs CSRF protection
        .send({ refreshToken: tokens.refreshToken });

      // Log details if it fails unexpectedly
      if (refreshRes.statusCode !== 200) {
        console.error("Refresh failed:", refreshRes.status, refreshRes.body);
      }
      if (refreshRes.body.accessToken === tokens.accessToken) {
        console.error("Tokens are identical!");
        console.log("Old Token:", tokens.accessToken);
        console.log("New Token:", refreshRes.body.accessToken);
      }

      expect(refreshRes.statusCode).toEqual(200);
      expect(refreshRes.body).toHaveProperty("accessToken");
      // Check that the new access token is different from the old one
      expect(refreshRes.body.accessToken).not.toEqual(tokens.accessToken);
      // Decode and check expiry/payload of the new token
      const decoded = jwt.decode(refreshRes.body.accessToken);
      expect(decoded.username).toEqual("testadmin");
    });

    it("should fail refresh with an invalid/malformed refresh token", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");

      const refreshRes = await agent
        .post("/api/admin/refresh")
        .set("x-csrf-token", csrfToken)
        .send({
          refreshToken:
            "thisIsNotAValidFormatTokenBecauseItIsTooShortAndNotHex" +
            crypto.randomBytes(10).toString("hex"),
        });

      expect(refreshRes.statusCode).toEqual(400);
      expect(refreshRes.body.message).toMatch(
        /invalid refresh token provided/i
      );
      expect(
        refreshRes.body.errors.some(
          (e) => e.msg === "Invalid refresh token format"
        )
      ).toBe(true);
    });

    it("should fail refresh with a valid format but non-existent refresh token", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const nonExistentToken = crypto.randomBytes(64).toString("hex");

      const refreshRes = await agent
        .post("/api/admin/refresh")
        .set("x-csrf-token", csrfToken)
        .send({ refreshToken: nonExistentToken });

      expect(refreshRes.statusCode).toEqual(403);
      expect(refreshRes.body.message).toMatch(/invalid refresh token/i);
      // Updated check: errors property should be null or undefined for this specific 403
      expect(refreshRes.body.errors).toBeFalsy();
    });

    it("should fail refresh if no refresh token is provided", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");

      const refreshRes = await agent
        .post("/api/admin/refresh")
        .set("x-csrf-token", csrfToken)
        .send({});

      expect(refreshRes.statusCode).toEqual(400);
      expect(refreshRes.body.message).toMatch(
        /invalid refresh token provided/i
      );
      expect(
        refreshRes.body.errors.some(
          (e) => e.param === "refreshToken" || e.path === "refreshToken"
        )
      ).toBe(true);
    });

    // TODO: Add test if user associated with refresh token needs password change
  });

  // --- Get User Info Tests ---
  describe("GET /api/admin/me", () => {
    // Helper to perform login and get access token for /me tests
    async function getAccessToken() {
      if (!csrfToken)
        throw new Error("CSRF token missing in getAccessToken helper");
      const loginRes = await agent
        .post("/api/admin/login")
        .set("x-csrf-token", csrfToken)
        .send({ username: "testadmin", password: "testpassword123" });
      if (loginRes.statusCode !== 200) {
        console.error(
          "Login failed within getAccessToken helper:",
          loginRes.body
        );
        throw new Error("Login failed during test setup");
      }
      return loginRes.body.accessToken;
    }

    it("should return user info with a valid access token", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const token = await getAccessToken();

      const meRes = await agent
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${token}`);

      expect(meRes.statusCode).toEqual(200);
      expect(meRes.body).toHaveProperty("id");
      expect(meRes.body).toHaveProperty("username", "testadmin");
      expect(meRes.body).toHaveProperty("role", "admin");
      expect(meRes.body).not.toHaveProperty("password");
      expect(meRes.body).not.toHaveProperty("refreshToken");
    });

    it("should fail if no access token is provided", async () => {
      const meRes = await agent.get("/api/admin/me");

      expect(meRes.statusCode).toEqual(401);
      expect(meRes.body.message).toMatch(/no token provided/i);
    });

    it("should fail if an invalid access token is provided", async () => {
      const meRes = await agent
        .get("/api/admin/me")
        .set("Authorization", "Bearer invalidtoken123");

      expect(meRes.statusCode).toEqual(403);
      expect(meRes.body.message).toMatch(/invalid token/i);
    });

    it("should fail if an expired access token is provided", async () => {
      if (!csrfToken) return pending("CSRF token unavailable");
      const user = await User.findOne({
        where: { username: "testadmin" },
        attributes: ["id"],
      });
      if (!user)
        throw new Error("Test admin user not found for expired token test");

      const expiredToken = jwt.sign(
        { userId: user.id, username: "testadmin", role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "-1s" } // Expired 1 second ago
      );

      const meRes = await agent
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(meRes.statusCode).toEqual(403);
      expect(meRes.body.message).toMatch(/invalid token/i);
    });
  });
}); // End of main describe block
