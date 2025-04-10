// client/src/change-initial-password.js
import "./style.css";

const API_BASE_URL = "/api"; // Match backend

// --- DOM Elements ---
const changePasswordForm = document.getElementById("change-password-form");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const messageElement = document.getElementById("change-password-message");
const usernameDisplay = document.getElementById("username-display");
const submitButton = changePasswordForm?.querySelector('button[type="submit"]'); // Get button reference

// --- State ---
let csrfToken = null; // Variable to store the CSRF token

// --- Get token/username from sessionStorage ---
const changePasswordToken = sessionStorage.getItem("changePasswordToken");
const username = sessionStorage.getItem("changeUsername");

// --- Display Message Function ---
function displayMessage(message, isError = false) {
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.className = `mt-4 text-center text-sm ${isError ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
}

// +++ Function to Fetch CSRF Token +++
async function fetchCsrfToken() {
  console.log("Fetching CSRF token for password change...");
  try {
    // Use credentials: 'include' to handle the CSRF cookie
    const response = await fetch(`${API_BASE_URL}/csrf-token`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }
    const data = await response.json();
    csrfToken = data.csrfToken; // Store the fetched token
    console.log("CSRF Token fetched successfully.");
    // Enable form only after token is fetched
    if (submitButton) submitButton.disabled = false;
    if (changePasswordForm) changePasswordForm.disabled = false; // Also enable form fields if needed
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    displayMessage(
      `Error initializing page: ${error.message}. Please refresh.`,
      true,
    );
    // Disable form if token fetch fails
    if (submitButton) submitButton.disabled = true;
    if (changePasswordForm) changePasswordForm.disabled = true; // Disable form fields
  }
}
// +++++++++++++++++++++++++++++++++++++

// --- Initial Page Setup ---
function initializePage() {
  // Display username if available
  if (username && usernameDisplay) {
    usernameDisplay.textContent = username;
  } else if (usernameDisplay) {
    usernameDisplay.textContent = "User"; // Fallback
  }

  // Disable form initially until CSRF token is fetched
  if (submitButton) submitButton.disabled = true;
  if (changePasswordForm) changePasswordForm.disabled = true; // Optional: disable inputs too

  // Check if session token exists on page load
  if (!changePasswordToken) {
    displayMessage(
      "Error: No password change token found. Please try logging in again.",
      true,
    );
    // Keep form disabled
  } else {
    // Fetch CSRF token if session token is present
    fetchCsrfToken();
  }
}

// --- Form Submission Handler ---
changePasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Check if CSRF token has been fetched
  if (!csrfToken) {
    displayMessage("Initialization error. Please refresh the page.", true);
    return;
  }

  displayMessage("Setting new password...", false);

  const newPassword = newPasswordInput?.value;
  const confirmPassword = confirmPasswordInput?.value;
  if (submitButton) submitButton.disabled = true; // Disable button during submission

  // Client-side validation
  if (!newPassword || newPassword.length < 8) {
    displayMessage("New password must be at least 8 characters long.", true);
    if (submitButton) submitButton.disabled = false;
    return;
  }
  if (newPassword !== confirmPassword) {
    displayMessage("Passwords do not match.", true);
    if (submitButton) submitButton.disabled = false;
    return;
  }
  if (!changePasswordToken) {
    displayMessage("Error: Missing password change token.", true);
    if (submitButton) submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/force-change-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // +++ Include CSRF token in header +++
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          changePasswordToken: changePasswordToken,
          newPassword: newPassword,
          confirmPassword: confirmPassword,
        }),
        // credentials: 'include' might be needed if backend CSRF checks cookies too, but often header is enough
        credentials: "include",
      },
    );

    const data = await response.json(); // Attempt to parse JSON regardless of status

    if (!response.ok) {
      // Use message from backend JSON response if available
      throw new Error(
        data.message || `Request failed with status ${response.status}`,
      );
    }

    // Success!
    displayMessage(
      "Password successfully changed! Redirecting to login...",
      false,
    );
    sessionStorage.removeItem("changePasswordToken");
    sessionStorage.removeItem("changeUsername");

    // Disable form completely on success before redirect
    if (changePasswordForm) changePasswordForm.disabled = true;
    if (submitButton) submitButton.disabled = true;

    setTimeout(() => {
      window.location.href = "/admin.html";
    }, 2500);
  } catch (error) {
    console.error("Error changing password:", error);
    displayMessage(`Error: ${error.message}`, true);
    if (submitButton) submitButton.disabled = false; // Re-enable button on failure
  }
});

// --- Run initial setup when DOM is ready ---
document.addEventListener("DOMContentLoaded", initializePage);
