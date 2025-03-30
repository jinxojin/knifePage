// client/src/mission.js
import "./style.css"; // Import base styles
// No dynamic data needs 't' or 'currentLang' here unless added later
// Import shared UI functions
import { initializeUI } from "./uiUtils.js";

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initializeUI(); // Setup header, footer, listeners, translate initial static elements
  // No dynamic data fetching needed for mission page (yet)
  console.log("Mission page initialized."); // Optional log
});
