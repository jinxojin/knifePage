// server/tests/integration/passwordReset.test.js
const request = require("supertest");
const { sequelize, User } = require("../../models");
const app = require("../../app");
const bcrypt = require("bcrypt");

// --- Mock Mailgun Service ---
let capturedResetToken = null;
let mailgunMockFn;

jest.mock("../../utils/mailgunService", () => {
  const mockSend = jest.fn().mockImplementation(async (email, token) => {
    console.log(
      `Mock sendPasswordResetEmail called for ${email}. Token: ${
        token ? "captured" : "missing"
      }`
    );
    capturedResetToken = token; // Capture the plaintext token
    return Promise.resolve({
      id: "<mock-id@mailgun>",
      message: "Queued. Thank you.",
    });
  });
  return {
    sendPasswordResetEmail: mockSend,
  };
});

// Assign the mock function reference AFTER jest.mock and require
const mailgunService = require("../../utils/mailgunService");
mailgunMockFn = mailgunService.sendPasswordResetEmail;

// Supertest agent for cookie/session persistence
const agent = request.agent(app);
let initialCsrfToken = null; // Store initial CSRF token

// --- Test Setup ---
beforeAll(async () => {
  // Fetch initial CSRF token once
  try {
    const res = await agent.get("/api/csrf-token");
    initialCsrfToken = res.body.csrfToken; // Use the new variable name
    if (!initialCsrfToken) throw new Error("Initial CSRF token fetch failed");
    console.log(
      "Initial CSRF token fetched for password reset tests:",
      initialCsrfToken
    );
  } catch (error) {
    console.error(
      "FATAL: Could not fetch initial CSRF token for password reset tests.",
      error
    );
    throw error;
  }
});

beforeEach(async () => {
  // Clean database
  await User.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });

  // Create a standard test user
  await User.create({
    username: "testuser",
    email: "testuser@example.com",
    password: "oldpassword123", // Let hook hash it
    role: "moderator",
    needsPasswordChange: false,
  });
  console.log("Test user created for password reset tests.");

  // Reset mock state and captured token before each test
  if (mailgunMockFn) {
    mailgunMockFn.mockClear();
  }
  capturedResetToken = null;
});

afterAll(async () => {
  await sequelize.close();
  console.log("DB connection closed after password reset tests.");
});

// --- Helper to get a fresh CSRF token ---
async function getFreshCsrfToken() {
  try {
    const res = await agent.get("/api/csrf-token");
    if (res.statusCode !== 200 || !res.body.csrfToken) {
      throw new Error(
        `Failed to get fresh CSRF token: ${res.status} ${JSON.stringify(
          res.body
        )}`
      );
    }
    console.log("Fetched fresh CSRF token:", res.body.csrfToken);
    return res.body.csrfToken;
  } catch (error) {
    console.error("Error fetching fresh CSRF token:", error);
    return null; // Return null or throw, depending on desired handling
  }
}
// --- End Helper ---

// --- Test Suites ---

describe("POST /api/auth/forgot-password", () => {
  it("should return 200 and send email for existing user", async () => {
    if (!initialCsrfToken) return pending("Initial CSRF token unavailable");
    if (!mailgunMockFn) return pending("Mailgun mock unavailable");

    const email = "testuser@example.com";
    const res = await agent
      .post("/api/auth/forgot-password")
      .set("x-csrf-token", initialCsrfToken) // Use initial token here
      .send({ email });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toMatch(/link has been sent/i);
    expect(mailgunMockFn).toHaveBeenCalledTimes(1);
    expect(mailgunMockFn).toHaveBeenCalledWith(email, expect.any(String));
    const user = await User.findOne({ where: { email } });
    expect(user).not.toBeNull();
    expect(user.passwordResetToken).not.toBeNull();
    expect(user.passwordResetExpires).not.toBeNull();
    const expires = user.passwordResetExpires.getTime();
    const now = Date.now();
    expect(expires).toBeGreaterThan(now + 59 * 60 * 1000);
    expect(expires).toBeLessThanOrEqual(now + 61 * 60 * 1000);
    expect(capturedResetToken).not.toBeNull();
  });

  it("should return 200 but NOT send email for non-existent user", async () => {
    if (!initialCsrfToken) return pending("Initial CSRF token unavailable");
    if (!mailgunMockFn) return pending("Mailgun mock unavailable");

    const email = "nosuchuser@example.com";
    const res = await agent
      .post("/api/auth/forgot-password")
      .set("x-csrf-token", initialCsrfToken) // Use initial token here
      .send({ email });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toMatch(/link has been sent/i);
    expect(mailgunMockFn).not.toHaveBeenCalled();
    const user = await User.findOne({ where: { email } });
    expect(user).toBeNull();
  });

  it("should return 400 for invalid email format", async () => {
    if (!initialCsrfToken) return pending("Initial CSRF token unavailable");
    if (!mailgunMockFn) return pending("Mailgun mock unavailable");

    const res = await agent
      .post("/api/auth/forgot-password")
      .set("x-csrf-token", initialCsrfToken) // Use initial token here
      .send({ email: "not-an-email" });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/validation error/i);
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.some((e) => e.path === "email")).toBe(true);
    expect(mailgunMockFn).not.toHaveBeenCalled();
  });

  it("should return 403 if CSRF token is missing/invalid", async () => {
    if (!mailgunMockFn) return pending("Mailgun mock unavailable");
    const res = await agent
      .post("/api/auth/forgot-password")
      .send({ email: "testuser@example.com" });

    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toMatch(/invalid csrf token/i);
    expect(mailgunMockFn).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password", () => {
  const newPassword = "newSecurePassword123";

  async function initiateReset() {
    if (!initialCsrfToken)
      throw new Error("Initial CSRF token needed for initiateReset");
    const email = "testuser@example.com";
    await agent
      .post("/api/auth/forgot-password")
      .set("x-csrf-token", initialCsrfToken) // Use initial token for this step
      .send({ email });

    if (!capturedResetToken) {
      console.error("Failed to capture reset token in initiateReset helper");
      throw new Error("Reset token not captured");
    }
    if (mailgunMockFn) mailgunMockFn.mockClear();
    return capturedResetToken;
  }

  it("should successfully reset password with valid token and matching passwords", async () => {
    const resetToken = await initiateReset(); // Gets the plaintext reset token

    // *** GET FRESH CSRF TOKEN ***
    const freshCsrf = await getFreshCsrfToken();
    if (!freshCsrf) return pending("Could not get fresh CSRF token");
    // **************************

    const resetRes = await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", freshCsrf) // *** USE FRESH TOKEN ***
      .send({
        token: resetToken, // Send the captured plaintext reset token
        newPassword: newPassword,
        confirmPassword: newPassword,
      });

    if (resetRes.statusCode !== 200) {
      // Log details if it fails
      console.error(
        "Reset Failed Unexpectedly:",
        resetRes.status,
        resetRes.body
      );
    }

    expect(resetRes.statusCode).toEqual(200);
    expect(resetRes.body.message).toMatch(
      /password has been successfully reset/i
    );
    const user = await User.findOne({
      where: { email: "testuser@example.com" },
    });
    expect(user).not.toBeNull();
    expect(user.passwordResetToken).toBeNull();
    expect(user.passwordResetExpires).toBeNull();

    // Verify login with old password fails
    const loginOldRes = await agent
      .post("/api/admin/login")
      .set("x-csrf-token", freshCsrf) // Use fresh token for subsequent requests
      .send({ username: "testuser", password: "oldpassword123" });
    expect(loginOldRes.statusCode).toEqual(401);

    // Verify login with new password succeeds
    const loginNewRes = await agent
      .post("/api/admin/login")
      .set("x-csrf-token", freshCsrf) // Use fresh token
      .send({ username: "testuser", password: newPassword });

    // Added logging for the new login attempt
    if (loginNewRes.statusCode !== 200) {
      console.error(
        "Login with NEW password FAILED:",
        loginNewRes.status,
        loginNewRes.body
      );
    }

    expect(loginNewRes.statusCode).toEqual(200);
    expect(loginNewRes.body).toHaveProperty("accessToken");
  });

  it("should fail with invalid token", async () => {
    await initiateReset(); // Set state but ignore captured token

    // *** GET FRESH CSRF TOKEN ***
    const freshCsrf = await getFreshCsrfToken();
    if (!freshCsrf) return pending("Could not get fresh CSRF token");
    // **************************

    const resetRes = await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", freshCsrf) // *** USE FRESH TOKEN ***
      .send({
        token: "invalidOrNonExistentTokenValue1234567890abcdef",
        newPassword: newPassword,
        confirmPassword: newPassword,
      });

    expect(resetRes.statusCode).toEqual(400);
    expect(resetRes.body).toHaveProperty("message"); // Ensure message property exists
    expect(resetRes.body.message).toMatch(/token is invalid or has expired/i);
    // For this specific error path, the 'errors' array might be null or undefined
    expect(resetRes.body.errors).toBeFalsy(); // Check if errors is null/undefined/false/empty string etc.
  });

  it("should fail with expired token", async () => {
    const token = await initiateReset();

    // Expire the token in the DB
    await User.update(
      { passwordResetExpires: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      { where: { email: "testuser@example.com" } }
    );

    // *** GET FRESH CSRF TOKEN ***
    const freshCsrf = await getFreshCsrfToken();
    if (!freshCsrf) return pending("Could not get fresh CSRF token");
    // **************************

    const resetRes = await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", freshCsrf) // *** USE FRESH TOKEN ***
      .send({
        token: token,
        newPassword: newPassword,
        confirmPassword: newPassword,
      });

    expect(resetRes.statusCode).toEqual(400);
    expect(resetRes.body).toHaveProperty("message");
    expect(resetRes.body.message).toMatch(/token is invalid or has expired/i);
    expect(resetRes.body.errors).toBeFalsy();
  });

  it("should fail if passwords do not match", async () => {
    const token = await initiateReset();

    // *** GET FRESH CSRF TOKEN ***
    const freshCsrf = await getFreshCsrfToken();
    if (!freshCsrf) return pending("Could not get fresh CSRF token");
    // **************************

    const resetRes = await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", freshCsrf) // *** USE FRESH TOKEN ***
      .send({
        token: token,
        newPassword: newPassword,
        confirmPassword: "differentPassword",
      });

    expect(resetRes.statusCode).toEqual(400);
    expect(resetRes.body.message).toMatch(/validation error/i);
    expect(resetRes.body.errors.some((e) => e.path === "confirmPassword")).toBe(
      true
    );
  });

  it("should fail validation for short password", async () => {
    const token = await initiateReset();

    // *** GET FRESH CSRF TOKEN ***
    const freshCsrf = await getFreshCsrfToken();
    if (!freshCsrf) return pending("Could not get fresh CSRF token");
    // **************************

    const resetRes = await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", freshCsrf) // *** USE FRESH TOKEN ***
      .send({ token: token, newPassword: "short", confirmPassword: "short" });

    expect(resetRes.statusCode).toEqual(400);
    expect(resetRes.body.message).toMatch(/validation error/i);
    expect(resetRes.body.errors.some((e) => e.path === "newPassword")).toBe(
      true
    );
  });

  it("should fail validation if token is missing", async () => {
    await initiateReset();

    // *** GET FRESH CSRF TOKEN ***
    const freshCsrf = await getFreshCsrfToken();
    if (!freshCsrf) return pending("Could not get fresh CSRF token");
    // **************************

    const resetRes = await agent
      .post("/api/auth/reset-password")
      .set("x-csrf-token", freshCsrf) // *** USE FRESH TOKEN ***
      .send({ newPassword: newPassword, confirmPassword: newPassword }); // Missing token

    expect(resetRes.statusCode).toEqual(400);
    expect(resetRes.body.message).toMatch(/validation error/i);
    expect(resetRes.body.errors.some((e) => e.path === "token")).toBe(true);
  });

  it("should return 403 if CSRF token is missing/invalid", async () => {
    const token = await initiateReset();

    const resetRes = await agent
      .post("/api/auth/reset-password")
      // No .set('x-csrf-token', ...)
      .send({
        token: token,
        newPassword: newPassword,
        confirmPassword: newPassword,
      });

    expect(resetRes.statusCode).toEqual(403);
    // FIX: Use resetRes here (Corrected from previous step)
    expect(resetRes.body.message).toMatch(/invalid csrf token/i);
  });
});
