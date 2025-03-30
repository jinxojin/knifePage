// client/src/competitions.js
import "./style.css"; // Import base styles
import { t, currentLang } from "./i18n.js"; // Only need t and currentLang
// Import functions from articles.js needed here
import { renderArticle, getArticlesByCategory } from "./articles.js";
// Import ONLY the main initializer from uiUtils.js
import { initializeUI } from "./uiUtils.js"; // <<<< CORRECT IMPORT

// --- DOM Elements ---
// Handled by uiUtils
const competitionContentContainer = document.getElementById(
  "competition-content",
);

// --- Competition Fetching/Rendering Logic ---
async function loadCompetitionData() {
  if (!competitionContentContainer) {
    console.error("Competition content container not found!");
    return;
  }
  competitionContentContainer.innerHTML = `<p class="text-center py-10">${t("loadingCompetitionDetails")}</p>`;

  try {
    // Fetch latest 'competition' category article
    const articles = await getArticlesByCategory("competition", currentLang, 1); // Use imported function

    if (articles && articles.length > 0) {
      const competitionArticle = articles[0];
      document.title = `${competitionArticle.title || t("competitionsTitle")} - MSKTF`;
      renderArticle(competitionArticle, competitionContentContainer); // Use imported function
    } else {
      competitionContentContainer.innerHTML = `<p class="text-center py-10">${t("noCompetitionData")}</p>`;
      document.title = `${t("competitionsTitle")} - MSKTF`;
    }
  } catch (error) {
    console.error("Error loading competition data:", error);
    competitionContentContainer.innerHTML = `<p class="text-center text-red-500 py-10">${t("errorLoadingData")}: ${error.message || ""}</p>`;
    document.title = `${t("competitionsTitle")} - MSKTF`;
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // Use the main UI initializer
  initializeUI(); // <<<< CALL THIS INSTEAD
  // Then load page-specific content
  loadCompetitionData();
});
