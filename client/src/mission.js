// client/src/mission.js
import "./style.css"; // Import base styles
// We only need t from i18n if we add dynamic elements later
// import { t } from './i18n.js';
// Import shared UI functions
import { setupLanguageSelector, translateStaticElements } from "./uiUtils.js";

// --- DOM Elements ---
// Language/Burger buttons handled by uiUtils
// No other specific elements needed for now

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // Use imported functions
  setupLanguageSelector();
  translateStaticElements();
  // No dynamic data fetching needed for mission page (yet)
  console.log("Mission page initialized."); // Optional log
});
