// client/src/competitions.js
import "./style.css";
import { t, currentLang } from "./i18n.js";
import { renderArticle } from "./articles.js"; // Keep render function import
import { initializeUI } from "./uiUtils.js";
import { getArticlesByCategorySlug } from "./apiService.js"; // Import from new apiService

// --- DOM Elements ---
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
    // Use new apiService function
    const articles = await getArticlesByCategorySlug("competition", {
      lang: currentLang,
      limit: 1,
    });
    const competitionArticle = articles[0] || null;

    if (competitionArticle) {
      document.title = `${competitionArticle.title || t("competitionsTitle")} - MSKTF`;
      renderArticle(competitionArticle, competitionContentContainer);
    } else {
      competitionContentContainer.innerHTML = `<p class="text-center py-10">${t("noCompetitionData")}</p>`;
      document.title = `${t("competitionsTitle")} - MSKTF`;
    }
  } catch (error) {
    // Catch errors from apiService call
    console.error("Error loading competition data:", error);
    competitionContentContainer.innerHTML = `<p class="text-center text-red-500 py-10">${t("errorLoadingData")}: ${error.message || ""}</p>`;
    document.title = `${t("competitionsTitle")} - MSKTF`;
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initializeUI(); // Setup header, footer, listeners, translate initial static elements
  loadCompetitionData(); // Load dynamic content specific to this page
});
