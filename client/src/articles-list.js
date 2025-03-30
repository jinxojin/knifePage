// client/src/articles-list.js
import "./style.css";
import { t, currentLang } from "./i18n.js";
import { renderArticleList } from "./articles.js"; // Import ONLY needed function
import { initializeUI, translateStaticElements } from "./uiUtils.js"; // Import UI utils
import { getPublicArticles } from "./apiService.js"; // Import from new apiService

// --- DOM Elements ---
const articlesContainer = document.getElementById("articles-list-container");
const paginationControls = document.getElementById("pagination-controls");

// --- State ---
let currentPage = 1;
const articlesPerPage = 6; // Match server default or desired number

// --- Article Fetching & Rendering ---
async function fetchAndRenderArticles(page = 1) {
  if (!articlesContainer) {
    console.error("[articles-list] Article list container not found!");
    return;
  }
  articlesContainer.innerHTML = `<p class="text-center py-10">${t("loadingArticles")}</p>`;
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

    // Render articles and pagination
    if (data && data.articles) {
      if (data.articles.length > 0) {
        renderArticleList(data.articles, articlesContainer);
        renderPagination(data.currentPage, data.totalPages);
      } else {
        articlesContainer.innerHTML = `<p class="text-center py-10">${t("noArticlesFound")}</p>`;
      }
      translateStaticElements(); // Translate pagination buttons AFTER renderPagination runs
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
    articlesContainer.innerHTML = `<p class="text-center text-red-500 py-10">${t("errorLoadingData")}: ${error.message}</p>`;
    if (paginationControls) paginationControls.innerHTML = "";
  }
}

// --- Pagination Rendering ---
function renderPagination(currentPage, totalPages) {
  if (!paginationControls || totalPages <= 1) {
    if (paginationControls) paginationControls.innerHTML = "";
    return;
  }
  let paginationHTML =
    '<div class="flex items-center justify-center space-x-1">';
  const prevDisabled = currentPage === 1;
  const prevText = t("paginationPrevious");
  paginationHTML += ` <button class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 ${prevDisabled ? "cursor-not-allowed opacity-50" : ""}" ${prevDisabled ? "disabled" : ""} onclick="changePage(${currentPage - 1})" aria-label="${prevText}" data-i18n="paginationPrevious"> ${prevText} </button>`;
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
    paginationHTML += ` <button class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600" onclick="changePage(1)" aria-label="Page 1">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="px-1.5 py-1.5 text-sm text-gray-500 dark:text-gray-400">...</span>`;
    }
  }
  for (let i = startPage; i <= endPage; i++) {
    const isCurrent = i === currentPage;
    paginationHTML += ` <button class="rounded border px-3 py-1.5 text-sm font-medium ${isCurrent ? "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-600 z-10" : "bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"}" onclick="changePage(${i})" ${isCurrent ? 'aria-current="page"' : ""} aria-label="Page ${i}"> ${i} </button>`;
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="px-1.5 py-1.5 text-sm text-gray-500 dark:text-gray-400">...</span>`;
    }
    paginationHTML += ` <button class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600" onclick="changePage(${totalPages})" aria-label="Page ${totalPages}">${totalPages}</button>`;
  }
  const nextDisabled = currentPage === totalPages;
  const nextText = t("paginationNext");
  paginationHTML += ` <button class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 ${nextDisabled ? "cursor-not-allowed opacity-50" : ""}" ${nextDisabled ? "disabled" : ""} onclick="changePage(${currentPage + 1})" aria-label="${nextText}" data-i18n="paginationNext"> ${nextText} </button>`;
  paginationHTML += "</div>";
  paginationControls.innerHTML = paginationHTML;
}

// --- Page Change Handler (keep global) ---
window.changePage = (page) => {
  if (page < 1) return;
  currentPage = page;
  fetchAndRenderArticles(page);
  const listTop = articlesContainer?.offsetTop || 0;
  window.scrollTo({ top: listTop - 80, behavior: "smooth" });
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initializeUI(); // Setup header, footer, listeners, translate initial static elements
  fetchAndRenderArticles(currentPage); // Fetch initial page data
});
