// client/src/forgot-password.js
import "./style.css"; // Import base styles if needed

const API_BASE = "/api"; // Relative path for Vite proxy
const AUTH_API_BASE = `${API_BASE}/auth`;

const form = document.getElementById("forgot-password-form");
const emailInput = document.getElementById("email");
const messageElement = document.getElementById("forgot-password-message");
const submitButton = form?.querySelector('button[type="submit"]');

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
  console.log("Fetching CSRF token for forgot password...");
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
    if (submitButton) submitButton.disabled = false;
    if (form) form.querySelector("input").disabled = false; // Enable input
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    displayMessage(
      `Error initializing page: ${error.message}. Please refresh.`,
      true,
    );
    // Keep form disabled if token fetch fails
    if (submitButton) submitButton.disabled = true;
    if (form) form.querySelector("input").disabled = true; // Disable input
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

  displayMessage("Sending request...", false);
  if (submitButton) submitButton.disabled = true;

  const email = emailInput?.value.trim();

  if (!email) {
    displayMessage("Please enter your email address.", true);
    if (submitButton) submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch(`${AUTH_API_BASE}/forgot-password`, {
      // Use AUTH_API_BASE
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // +++ Include CSRF token in header +++
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ email }),
      // +++ Include credentials to send cookie +++
      credentials: "include",
    });

    // Read response body regardless of status
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

    // Display the generic success message from the backend
    displayMessage(data.message, false);
    // Optionally clear the form or disable it further
    emailInput.value = ""; // Clear email field on success
  } catch (error) {
    console.error("Forgot Password Error:", error);
    displayMessage(`Error: ${error.message}`, true);
    if (submitButton) submitButton.disabled = false; // Re-enable button on error
  }
  // Note: Button remains disabled on success to prevent resubmission
});

// --- Initial Setup ---
document.addEventListener("DOMContentLoaded", () => {
  displayMessage(""); // Clear initial message
  // Disable form initially until CSRF token is fetched
  if (submitButton) submitButton.disabled = true;
  if (form) form.querySelector("input").disabled = true;
  fetchCsrfToken(); // Fetch token on page load
});
