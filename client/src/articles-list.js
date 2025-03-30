// client/src/articles-list.js
import "./style.css";
import { t, currentLang } from "./i18n.js";
import { renderArticleList } from "./articles.js"; // Import ONLY needed function
import { initializeUI, translateStaticElements } from "./uiUtils.js"; // Import UI utils

// --- DOM Elements ---
const articlesContainer = document.getElementById("articles-list-container");
const paginationControls = document.getElementById("pagination-controls");

// --- State ---
let currentPage = 1;
const articlesPerPage = 6;

// --- Article Fetching & Rendering ---
async function fetchAndRenderArticles(page = 1) {
  if (!articlesContainer) {
    console.error("[articles-list] Article list container not found!");
    return;
  }
  articlesContainer.innerHTML = `<p class="text-center py-10">${t("loadingArticles")}</p>`;
  if (paginationControls) paginationControls.innerHTML = "";

  const apiUrl = `/api/articles?category=news,blog&page=${page}&limit=${articlesPerPage}&lang=${currentLang}`;
  console.log(`[articles-list] Fetching: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);
    console.log(
      `[articles-list] Fetch status for page ${page}: ${response.status}`,
    );

    if (!response.ok) {
      let errorMsg = `Failed to fetch articles (status: ${response.status})`;
      let responseText = "";
      try {
        responseText = await response.text();
        console.error(
          "[articles-list] Received non-OK response text:",
          responseText,
        );
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = JSON.parse(responseText);
            errorMsg = errorData.message || errorMsg;
            console.error(
              "[articles-list] Parsed non-OK JSON response:",
              errorData,
            );
          } else {
            errorMsg += ` - Server Response: ${responseText.substring(0, 150)}${responseText.length > 150 ? "..." : ""}`;
          }
        } catch (parseError) {
          console.error(
            "[articles-list] Failed to parse non-OK response as JSON:",
            parseError,
          );
          errorMsg += ` - Server Response: ${responseText.substring(0, 150)}${responseText.length > 150 ? "..." : ""}`;
        }
      } catch (textError) {
        console.error(
          "[articles-list] Could not read response text:",
          textError,
        );
        errorMsg += ` - Could not read server response.`;
      }
      throw new Error(errorMsg);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      console.error(
        `[articles-list] Expected JSON, received Content-Type: ${contentType}. Response text:`,
        responseText,
      );
      throw new Error(
        `Received invalid content type from server: ${contentType}`,
      );
    }

    const data = await response.json();
    console.log(`[articles-list] Received data for page ${page}:`, data);

    if (data && data.articles) {
      if (data.articles.length > 0) {
        renderArticleList(data.articles, articlesContainer); // Use imported function
        renderPagination(data.currentPage, data.totalPages);
      } else {
        articlesContainer.innerHTML = `<p class="text-center py-10">${t("noArticlesFound")}</p>`;
      }
      // Translate pagination buttons AFTER they are rendered
      translateStaticElements(); // Call here specifically for pagination
    } else {
      console.error(
        "[articles-list] Received OK response but data format is unexpected:",
        data,
      );
      throw new Error("Received unexpected data format from server.");
    }
  } catch (error) {
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
