// client/src/articles-list.js
import "./style.css"; // Import base styles
import { t, currentLang, setLanguage } from "./i18n.js";
// Reuse rendering function and date helper from articles.js
import { renderArticleList } from "./articles.js"; // Ensure renderArticleList is exported from articles.js

// --- DOM Elements ---
const languageBtn = document.getElementById("language-btn");
const languageDropdown = document.getElementById("language-dropdown");
const articlesContainer = document.getElementById("articles-list-container");
const paginationControls = document.getElementById("pagination-controls");

// --- State ---
let currentPage = 1;
const articlesPerPage = 6; // Match server default or desired number

// --- Language Selector Logic ---
function setupLanguageSelector() {
  if (!languageBtn || !languageDropdown) {
    console.warn(
      "[articles-list] Language selector elements not found on this page.",
    );
    return;
  }
  const currentLangDisplay = document.getElementById("current-lang-display");
  if (currentLangDisplay) {
    currentLangDisplay.textContent = currentLang.toUpperCase();
  }
  languageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    languageDropdown.classList.toggle("hidden");
  });
  languageDropdown.addEventListener("click", (e) => {
    if (e.target.tagName === "A" && e.target.dataset.lang) {
      e.preventDefault();
      setLanguage(e.target.dataset.lang);
      languageDropdown.classList.add("hidden");
    }
  });
  document.addEventListener("click", (e) => {
    if (
      !languageBtn.contains(e.target) &&
      !languageDropdown.contains(e.target)
    ) {
      languageDropdown.classList.add("hidden");
    }
  });

  // Add mobile menu logic
  const burgerBtn = document.getElementById("burger-btn");
  if (burgerBtn) {
    createMobileMenu();
  }
}

// --- Mobile Menu Logic (Consistent across pages) ---
function createMobileMenu() {
  const burgerBtn = document.getElementById("burger-btn");
  if (!burgerBtn) return;
  const navUl = document.querySelector("header nav ul");
  if (!navUl) return;
  let dropdown = document.getElementById("mobile-menu");

  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "mobile-menu";
    dropdown.className = `md:hidden fixed top-14 left-0 right-0 w-full bg-white/95 dark:bg-primary-800/95 backdrop-blur-sm shadow-md overflow-hidden transition-max-height duration-300 ease-in-out z-40`;
    dropdown.style.maxHeight = "0";

    const nav = navUl.cloneNode(true);
    nav.className = "flex flex-col items-center py-4 space-y-2";
    nav
      .querySelectorAll("a")
      .forEach((a) =>
        a.classList.add(
          "block",
          "py-2",
          "px-4",
          "rounded",
          "hover:bg-gray-100",
          "dark:hover:bg-primary-700",
          "w-full",
          "text-center",
        ),
      );
    dropdown.appendChild(nav);
    document
      .querySelector("header nav")
      ?.insertAdjacentElement("afterend", dropdown);
  } else {
    dropdown.style.maxHeight = "0";
  }

  burgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const currentDropdown = document.getElementById("mobile-menu");
    if (!currentDropdown) return;
    const isOpen = currentDropdown.style.maxHeight !== "0px";
    const innerNav = currentDropdown.querySelector("ul");
    currentDropdown.style.maxHeight = isOpen
      ? "0"
      : `${innerNav?.scrollHeight || 200}px`;
  });

  document.addEventListener("click", (e) => {
    const mobileMenu = document.getElementById("mobile-menu");
    if (
      mobileMenu &&
      !mobileMenu.contains(e.target) &&
      !burgerBtn.contains(e.target) &&
      mobileMenu.style.maxHeight !== "0px"
    ) {
      mobileMenu.style.maxHeight = "0";
    }
  });
}

// --- Function to translate static elements ---
function translateStaticElements() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const paramsAttr = element.getAttribute("data-i18n-params");
    let params = {};
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.error(
          `[articles-list] Error parsing i18n params for key "${key}":`,
          e,
        );
      }
    }
    if (key === "footerCopyright") {
      params.year = new Date().getFullYear();
    }

    if (element.hasAttribute("placeholder")) {
      element.placeholder = t(key, params);
    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    } else {
      if (
        key === "footerCopyright" ||
        element.closest("#pagination-controls")
      ) {
        element.innerHTML = t(key, params);
      } else {
        element.textContent = t(key, params);
      }
    }
  });
  // Nav links handled by data-i18n
}

// --- Article Fetching & Rendering (with Server-Side Pagination) ---
async function fetchAndRenderArticles(page = 1) {
  if (!articlesContainer) {
    console.error("[articles-list] Article list container not found!");
    return;
  }
  articlesContainer.innerHTML = `<p class="text-center py-10">${t("loadingArticles")}</p>`;
  if (paginationControls) paginationControls.innerHTML = ""; // Clear old controls

  const apiUrl = `/api/articles?category=news,blog&page=${page}&limit=${articlesPerPage}&lang=${currentLang}`;
  console.log(`[articles-list] Fetching: ${apiUrl}`); // Log the URL being fetched

  try {
    const response = await fetch(apiUrl);
    console.log(
      `[articles-list] Fetch status for page ${page}: ${response.status}`,
    ); // Log status code

    if (!response.ok) {
      let errorMsg = `Failed to fetch articles (status: ${response.status})`;
      let responseText = "";
      try {
        responseText = await response.text();
        console.error(
          "[articles-list] Received non-OK response text:",
          responseText,
        ); // Log raw text
        try {
          // Attempt to parse as JSON *only* if content-type suggests it
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = JSON.parse(responseText);
            errorMsg = errorData.message || errorMsg; // Use server message if available
            console.error(
              "[articles-list] Parsed non-OK JSON response:",
              errorData,
            );
          } else {
            // If not JSON, include raw text snippet in error
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
      throw new Error(errorMsg); // Throw the constructed error message
    }

    // --- Response is OK (2xx status) ---
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      console.error(
        `[articles-list] Expected JSON, but received Content-Type: ${contentType}. Response text:`,
        responseText,
      );
      throw new Error(
        `Received invalid content type from server: ${contentType}`,
      );
    }

    // --- Parse JSON response ---
    const data = await response.json();
    console.log(`[articles-list] Received data for page ${page}:`, data);

    if (data && data.articles) {
      // Check if data and data.articles exist
      if (data.articles.length > 0) {
        renderArticleList(data.articles, articlesContainer);
        renderPagination(data.currentPage, data.totalPages);
      } else {
        articlesContainer.innerHTML = `<p class="text-center py-10">${t("noArticlesFound")}</p>`;
      }
    } else {
      // Handle cases where the structure is unexpected but status was ok
      console.error(
        "[articles-list] Received OK response but data format is unexpected:",
        data,
      );
      throw new Error("Received unexpected data format from server.");
    }
  } catch (error) {
    // Catches errors from fetch(), response parsing, or rendering
    console.error("[articles-list] Error during fetch/render process:", error);
    articlesContainer.innerHTML = `<p class="text-center text-red-500 py-10">${t("errorLoadingData")}: ${error.message}</p>`;
    // Clear pagination on error
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

  // Previous Button
  const prevDisabled = currentPage === 1;
  const prevText = t("paginationPrevious");
  paginationHTML += `
     <button
       class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 ${prevDisabled ? "cursor-not-allowed opacity-50" : ""}"
       ${prevDisabled ? "disabled" : ""}
       onclick="changePage(${currentPage - 1})"
       aria-label="${prevText}">
       ${prevText}
     </button>`;

  // Page Numbers Logic
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
    paginationHTML += `
        <button class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600" onclick="changePage(1)" aria-label="Page 1">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="px-1.5 py-1.5 text-sm text-gray-500 dark:text-gray-400">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isCurrent = i === currentPage;
    paginationHTML += `
       <button
         class="rounded border px-3 py-1.5 text-sm font-medium ${isCurrent ? "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-600 z-10" : "bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"}"
         onclick="changePage(${i})"
         ${isCurrent ? 'aria-current="page"' : ""}
         aria-label="Page ${i}">
         ${i}
       </button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="px-1.5 py-1.5 text-sm text-gray-500 dark:text-gray-400">...</span>`;
    }
    paginationHTML += `
         <button class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600" onclick="changePage(${totalPages})" aria-label="Page ${totalPages}">${totalPages}</button>`;
  }

  // Next Button
  const nextDisabled = currentPage === totalPages;
  const nextText = t("paginationNext");
  paginationHTML += `
     <button
       class="rounded border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 ${nextDisabled ? "cursor-not-allowed opacity-50" : ""}"
       ${nextDisabled ? "disabled" : ""}
       onclick="changePage(${currentPage + 1})"
       aria-label="${nextText}">
       ${nextText}
     </button>`;

  paginationHTML += "</div>";
  paginationControls.innerHTML = paginationHTML;
}

// --- Page Change Handler (needs to be global for onclick) ---
window.changePage = (page) => {
  if (page < 1) return;
  currentPage = page;
  fetchAndRenderArticles(page);
  const listTop = articlesContainer?.offsetTop || 0;
  window.scrollTo({ top: listTop - 80, behavior: "smooth" });
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  setupLanguageSelector();
  translateStaticElements();
  fetchAndRenderArticles(currentPage);
});
