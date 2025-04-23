// client/src/competitions.js
import "./style.css";
import { t, currentLang } from "./i18n.js";
import { renderArticle } from "./articles.js"; // Keep render function import
import { initializeUI } from "./uiUtils.js";
// Import BOTH API functions needed
import {
  getArticlesByCategorySlug,
  getPublicArticleById,
} from "./apiService.js";

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
  let competitionArticle = null; // Variable to hold the final article object

  try {
    // STEP 1: Fetch the latest competition article's basic info (including ID)
    console.log("[competitions.js] Fetching latest competition ID...");
    const articles = await getArticlesByCategorySlug("competition", {
      lang: currentLang, // Keep lang for potential title/excerpt use if needed later
      limit: 1,
    });

    console.log(
      "[competitions.js] Step 1 API Response (Category Slug):",
      articles,
    );

    const latestCompetitionInfo =
      articles && Array.isArray(articles) && articles.length > 0
        ? articles[0]
        : null;
    const articleId = latestCompetitionInfo?.id;

    if (!articleId) {
      console.log("[competitions.js] No competition article ID found.");
      throw new Error(t("noCompetitionData")); // Throw specific error
    }

    // STEP 2: Fetch the FULL article details using the ID
    console.log(
      `[competitions.js] Fetching full details for article ID: ${articleId}...`,
    );
    competitionArticle = await getPublicArticleById(articleId, {
      lang: currentLang,
    });

    console.log(
      "[competitions.js] Step 2 API Response (Article By ID):",
      competitionArticle,
    );

    // Check if the second fetch returned a valid article object with content
    if (
      !competitionArticle ||
      typeof competitionArticle !== "object" ||
      !competitionArticle.content
    ) {
      console.error(
        "[competitions.js] Full article data missing or invalid content for ID:",
        articleId,
        competitionArticle,
      );
      throw new Error(t("errorLoadingData")); // Or a more specific error
    }

    // STEP 3: Render the full article
    document.title = `${competitionArticle.title || t("competitionsTitle")} - MSKTF`;
    renderArticle(competitionArticle, competitionContentContainer); // Pass the full object
  } catch (error) {
    // Catch errors from either API call or processing
    console.error("[competitions.js] Error loading competition data:", error);
    // Display error based on the message caught
    competitionContentContainer.innerHTML = `<p class="text-center text-red-500 py-10">${error.message || t("errorLoadingData")}</p>`;
    document.title = `${t("competitionsTitle")} - MSKTF`; // Set default title on error
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initializeUI();
  loadCompetitionData();
});
