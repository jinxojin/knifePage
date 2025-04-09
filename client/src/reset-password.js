// client/src/reset-password.js
import "./style.css";

const API_BASE = "/api"; // Relative path for Vite proxy
const AUTH_API_BASE = `${API_BASE}/auth`;

const form = document.getElementById("reset-password-form");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const messageElement = document.getElementById("reset-password-message");
const submitButton = form?.querySelector('button[type="submit"]');

// --- Get Token from URL ---
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get("token");
// -------------------------

let csrfToken = null; // Variable to store the CSRF token

function displayMessage(message, isError = false) {
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.className = `mt-4 text-center text-sm ${
    isError
      ? "text-red-500 dark:text-red-400"
      : "text-green-600 dark:text-green-400"
  }`;
  messageElement.classList.toggle("hidden", !message);
}

// --- Function to Fetch CSRF Token ---
async function fetchCsrfToken() {
  console.log("Fetching CSRF token for reset password...");
  try {
    // Use credentials: 'include' to handle the CSRF cookie
    const response = await fetch(`${API_BASE}/csrf-token`, {
      // Use API_BASE
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSRF token: ${response.status} ${response.statusText}`,
      );
    }
    const data = await response.json();
    csrfToken = data.csrfToken; // Store the fetched token
    console.log("CSRF Token fetched successfully.");
    // Enable form only after token is fetched
    if (submitButton && resetToken) submitButton.disabled = false; // Enable only if URL token also exists
    if (form && resetToken) {
      form
        .querySelectorAll("input")
        .forEach((input) => (input.disabled = false)); // Enable inputs
    }
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    displayMessage(
      `Error initializing page: ${error.message}. Please refresh.`,
      true,
    );
    // Keep form disabled if token fetch fails
    if (submitButton) submitButton.disabled = true;
    if (form) {
      form
        .querySelectorAll("input")
        .forEach((input) => (input.disabled = true)); // Disable inputs
    }
  }
}
// --- End CSRF Fetch ---

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  // --- Check if CSRF token is available ---
  if (!csrfToken) {
    displayMessage(
      "Initialization error. Cannot submit form. Please refresh.",
      true,
    );
    return;
  }
  // ---------------------------------------

  if (!resetToken) {
    // Double check URL token is present
    displayMessage("Error: Missing reset token.", true);
    return;
  }

  const newPassword = newPasswordInput?.value;
  const confirmPassword = confirmPasswordInput?.value;

  // Client-side validation
  if (!newPassword || newPassword.length < 8) {
    displayMessage("New password must be at least 8 characters long.", true);
    return;
  }
  if (newPassword !== confirmPassword) {
    displayMessage("Passwords do not match.", true);
    return;
  }

  displayMessage("Resetting password...", false);
  if (submitButton) submitButton.disabled = true;

  try {
    const response = await fetch(`${AUTH_API_BASE}/reset-password`, {
      // Use AUTH_API_BASE
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // +++ Include CSRF token in header +++
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        token: resetToken,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      }),
      // +++ Include credentials to send cookie +++
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      // Check if it's a CSRF error specifically
      if (
        response.status === 403 &&
        data.message?.toLowerCase().includes("invalid csrf token")
      ) {
        displayMessage(
          "Security token mismatch. Please refresh the page and try again.",
          true,
        );
        csrfToken = null; // Clear potentially stale token
        fetchCsrfToken(); // Attempt to fetch a new one automatically
        if (submitButton) submitButton.disabled = false; // Allow retry after refresh
        return;
      }
      // Otherwise, use message from backend response
      throw new Error(
        data.message || `Request failed with status ${response.status}`,
      );
    }

    // Success!
    displayMessage(data.message + " Redirecting to login...", false);
    if (form) form.classList.add("hidden"); // Hide form on success

    // Redirect to login page after a short delay
    setTimeout(() => {
      window.location.href = "/admin.html"; // Redirect to the admin login page
    }, 3000); // 3-second delay
  } catch (error) {
    console.error("Reset Password Error:", error);
    displayMessage(`Error: ${error.message}`, true);
    if (submitButton) submitButton.disabled = false; // Re-enable button on error
  }
});

// --- Initial Setup ---
document.addEventListener("DOMContentLoaded", () => {
  // Disable form initially until CSRF token is fetched AND URL token exists
  if (submitButton) submitButton.disabled = true;
  if (form) {
    form.querySelectorAll("input").forEach((input) => (input.disabled = true));
  }

  if (!resetToken) {
    displayMessage(
      "Error: No password reset token found in URL. Please use the link from your email.",
      true,
    );
    // Keep form disabled
  } else {
    displayMessage(""); // Clear message if token exists
    fetchCsrfToken(); // Fetch CSRF token only if URL token is present
  }
});
