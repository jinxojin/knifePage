// client/src/articles-list.js
import "./style.css";
import { t, currentLang } from "./i18n.js";
// === Import the function responsible for rendering the list ===
import { renderArticleList } from "./articles.js";
// ==============================================================
import { initializeUI, translateStaticElements } from "./uiUtils.js"; // Import UI utils
import { getPublicArticles } from "./apiService.js"; // Import from new apiService

// --- DOM Elements ---
// ============================ CORRECTION =============================
// The ID of the container in articles.html was changed to 'articles-grid'
// when implementing the grid layout. Update this line to match.
const articlesContainer = document.getElementById("articles-grid");
// =====================================================================
const paginationControls = document.getElementById("pagination-controls");

// --- State ---
let currentPage = 1;
const articlesPerPage = 6; // Match server default or desired number

// --- Article Fetching & Rendering ---
async function fetchAndRenderArticles(page = 1) {
  if (!articlesContainer) {
    // This error message should now only appear if 'articles-grid' truly doesn't exist in the HTML
    console.error(
      "[articles-list] Article grid container (#articles-grid) not found!",
    );
    return;
  }
  // Clear previous content or show loading indicator
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "block"; // Make sure loading is visible
    // Remove any previously loaded article cards siblings of the indicator
    Array.from(articlesContainer.children).forEach((child) => {
      if (child.id !== "loading-indicator") {
        articlesContainer.removeChild(child);
      }
    });
  } else {
    // Fallback if indicator isn't found (though it should be)
    articlesContainer.innerHTML = `<p id="loading-indicator" class="col-span-full text-center py-10">${t("loadingArticles")}</p>`;
  }

  if (paginationControls) paginationControls.innerHTML = "";

  try {
    // Use new apiService function
    const data = await getPublicArticles({
      category: "news,blog", // Combine categories
      page: page,
      limit: articlesPerPage,
      lang: currentLang,
    });

    console.log(`[articles-list] Received data for page ${page}:`, data);

    // Hide loading indicator before rendering articles
    const finalLoadingIndicator = document.getElementById("loading-indicator");
    if (finalLoadingIndicator) {
      finalLoadingIndicator.style.display = "none";
    }

    // Render articles and pagination
    if (data && data.articles) {
      if (data.articles.length > 0) {
        // === Call the imported function to render the list ===
        // It should now append articles correctly to the #articles-grid container
        renderArticleList(data.articles, articlesContainer);
        // =====================================================
        renderPagination(data.currentPage, data.totalPages);
      } else {
        // Display no articles found message within the grid container
        articlesContainer.innerHTML = `<p class="col-span-full text-center py-10">${t("noArticlesFound")}</p>`;
      }
      // Translate pagination buttons AFTER renderPagination runs
      // Also ensure elements within rendered articles that use data-i18n are translated if needed
      translateStaticElements();
    } else {
      console.error(
        "[articles-list] API response data format is unexpected:",
        data,
      );
      throw new Error("Received unexpected data format from server.");
    }
  } catch (error) {
    // Catch errors from apiService call
    console.error("[articles-list] Error during fetch/render process:", error);
    // Hide loading indicator on error too
    const errorLoadingIndicator = document.getElementById("loading-indicator");
    if (errorLoadingIndicator) {
      errorLoadingIndicator.style.display = "none";
    }
    articlesContainer.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">${t("errorLoadingData")}: ${error.message}</p>`;
    if (paginationControls) paginationControls.innerHTML = "";
  }
}

// --- Pagination Rendering ---
function renderPagination(currentPage, totalPages) {
  if (!paginationControls || totalPages <= 1) {
    if (paginationControls) paginationControls.innerHTML = "";
    return;
  }
  // --- Apply .btn styling to pagination buttons for consistency ---
  let paginationHTML =
    '<div class="flex items-center justify-center space-x-1">';
  const prevDisabled = currentPage === 1;
  const prevText = t("paginationPrevious");
  // Added btn btn-gray classes, removed explicit border/bg/text/hover utilities
  paginationHTML += ` <button class="btn btn-gray px-3 py-1.5 text-sm ${prevDisabled ? "cursor-not-allowed opacity-50" : ""}" ${prevDisabled ? "disabled" : ""} onclick="changePage(${currentPage - 1})" aria-label="${prevText}" data-i18n="paginationPrevious"> ${prevText} </button>`;

  const maxPagesToShow = 5;
  const pageNeighbours = Math.floor((maxPagesToShow - 3) / 2);
  let startPage = Math.max(1, currentPage - pageNeighbours);
  let endPage = Math.min(totalPages, currentPage + pageNeighbours);
  if (currentPage - pageNeighbours <= 1) {
    endPage = Math.min(totalPages, maxPagesToShow - 1);
  }
  if (currentPage + pageNeighbours >= totalPages) {
    startPage = Math.max(1, totalPages - maxPagesToShow + 2);
  }

  if (startPage > 1) {
    // Use btn btn-gray for page numbers
    paginationHTML += ` <button class="btn btn-gray px-3 py-1.5 text-sm" onclick="changePage(1)" aria-label="Page 1">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="px-1.5 py-1.5 text-sm text-gray-500 dark:text-gray-400">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isCurrent = i === currentPage;
    // Use btn-blue for current page, btn-gray for others
    const buttonClass = isCurrent ? "btn btn-blue" : "btn btn-gray";
    paginationHTML += ` <button class="${buttonClass} px-3 py-1.5 text-sm ${isCurrent ? "z-10" : ""}" onclick="changePage(${i})" ${isCurrent ? 'aria-current="page"' : ""} aria-label="Page ${i}"> ${i} </button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="px-1.5 py-1.5 text-sm text-gray-500 dark:text-gray-400">...</span>`;
    }
    // Use btn btn-gray for last page number
    paginationHTML += ` <button class="btn btn-gray px-3 py-1.5 text-sm" onclick="changePage(${totalPages})" aria-label="Page ${totalPages}">${totalPages}</button>`;
  }

  const nextDisabled = currentPage === totalPages;
  const nextText = t("paginationNext");
  // Added btn btn-gray classes
  paginationHTML += ` <button class="btn btn-gray px-3 py-1.5 text-sm ${nextDisabled ? "cursor-not-allowed opacity-50" : ""}" ${nextDisabled ? "disabled" : ""} onclick="changePage(${currentPage + 1})" aria-label="${nextText}" data-i18n="paginationNext"> ${nextText} </button>`;
  paginationHTML += "</div>";
  // --- End button class changes ---
  paginationControls.innerHTML = paginationHTML;

  // Apply translations to the newly added pagination buttons
  translateStaticElements();
}

// --- Page Change Handler (keep global) ---
window.changePage = (page) => {
  if (page < 1) return;
  currentPage = page;
  fetchAndRenderArticles(page);
  const listTop = articlesContainer?.offsetTop || 0;
  window.scrollTo({ top: listTop - 80, behavior: "smooth" }); // Adjust scroll offset if needed (80px approx header height + margin)
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initializeUI(); // Setup header, footer, listeners, translate initial static elements
  fetchAndRenderArticles(currentPage); // Fetch initial page data
});
