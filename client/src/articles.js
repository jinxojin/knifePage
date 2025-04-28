// client/src/articles.js

// Log immediately to see if the script file itself is parsed/executed at all
console.log("--- articles.js script STARTING TO EXECUTE ---");

// Restore necessary imports
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { enUS, ru, mn } from "date-fns/locale"; // Import locales needed
import { t, currentLang } from "./i18n.js";
import { initializeUI, translateStaticElements } from "./uiUtils.js"; // Ensure this is imported
import { getPublicArticleById } from "./apiService.js"; // Ensure this is imported

// Define constants needed
const dateLocales = { en: enUS, rus: ru, mng: mn }; // Map language codes to locales

// --- HELPER: Category Badge Classes ---
function getCategoryBadgeClasses(category) {
  const baseClasses =
    "inline-block px-2.5 py-0.5 rounded text-xs font-medium capitalize";
  switch (category?.toLowerCase()) {
    case "news":
      return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300`;
    case "competition":
      return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300`;
    case "blog":
      return `${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300`; // Fallback
  }
}
// --- END HELPER ---

// --- Date Formatting Helper ---
// Exported function to get display and hover strings for dates
export function getConditionalTimestampStrings(dateObj) {
  // console.log("--- getConditionalTimestampStrings called ---"); // Reduced logging noise
  let displayString = "Unknown date";
  let hoverString = "";
  const now = new Date();
  const locale = dateLocales[currentLang] || enUS; // Use current language locale or fallback
  try {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      throw new Error("Invalid date object received");
    }
    const hoursDifference = differenceInHours(now, dateObj);
    const fullDateFormat = format(dateObj, "PPP", { locale }); // e.g., Apr 10th, 2025
    const relativeTimeFormat = formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: locale,
    }); // e.g., 2 days ago

    // Show relative time if recent, otherwise show full date
    if (hoursDifference < 24) {
      displayString = relativeTimeFormat;
      hoverString = fullDateFormat;
    } else {
      displayString = fullDateFormat;
      hoverString = relativeTimeFormat;
    }
  } catch (e) {
    console.error("Error processing date:", dateObj, e);
    // Provide fallbacks in case of error
    hoverString = "Invalid date";
    displayString = "Invalid date";
  }
  return { displayString, hoverString };
}

// --- Single Article Rendering ---
// Exported function to render a single article's details
export function renderArticle(article, container) {
  console.log("--- renderArticle START, article ID:", article?.id);
  if (!article) {
    container.innerHTML = `<p class="text-red-500 p-6">${t("errorLoadingData")}</p>`;
    console.log("--- renderArticle END (no article data) ---");
    return;
  }

  let dateObj;
  try {
    dateObj = new Date(article.createdAt);
    if (isNaN(dateObj.getTime())) {
      throw new Error("Invalid createdAt date format from API");
    }
  } catch (dateError) {
    console.error(
      "Error creating Date object from article.createdAt:",
      article.createdAt,
      dateError,
    );
    dateObj = null;
  }

  const { displayString, hoverString } = dateObj
    ? getConditionalTimestampStrings(dateObj)
    : { displayString: "Invalid Date", hoverString: "" };

  const title = article.title || t("untitledArticle");
  const content = article.content || `<p>${t("noContentAvailable")}</p>`;

  const articleHTML = `
    <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-600">
      ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${title}" class="w-full h-auto max-h-96 object-cover">` : ""}
      <div class="p-4 md:p-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">${title}</h1>
        <div class="flex flex-wrap items-center text-gray-500 dark:text-gray-400 text-sm mb-6 space-x-3">
            <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span>
            <span class="hidden sm:inline">•</span>
            <span class="capitalize whitespace-nowrap">${article.category || "Unknown"}</span>
            <span class="hidden sm:inline">•</span>
            <span class="flex items-center whitespace-nowrap">
              <svg class="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg>
              ${article.views ?? 0} views
            </span>
        </div>
        <div class="prose dark:prose-invert max-w-none mt-6">
            ${content}
        </div>
      </div>
    </article>
  `;
  container.innerHTML = articleHTML;
  console.log("--- renderArticle END ---");
}

// --- Article List Rendering ---
// Exported function to render a list of articles (used by articles-list.js)
export function renderArticleList(articles, container) {
  console.log("--- renderArticleList called ---");
  if (!articles || articles.length === 0) {
    // Ensure this message spans the grid correctly if no articles
    container.innerHTML = `<p class="col-span-full text-center py-10">${t("noArticlesFound")}</p>`;
    return;
  }

  // Clear the container BEFORE appending. We assume the loading indicator was handled by the calling function.
  container.innerHTML = "";

  articles.forEach((article, index) => {
    if (!article) {
      console.warn(
        `[renderArticleList] Skipping invalid article at index ${index}`,
      );
      return; // Skip this iteration
    }

    let dateObj;
    try {
      dateObj = new Date(article.createdAt);
      if (isNaN(dateObj.getTime())) {
        throw new Error("Invalid createdAt date format from API");
      }
    } catch (dateError) {
      console.warn(
        `[renderArticleList] Invalid date for article ID ${article.id}:`,
        article.createdAt,
        dateError,
      );
      dateObj = null;
    }

    const { displayString, hoverString } = dateObj
      ? getConditionalTimestampStrings(dateObj)
      : { displayString: "Invalid Date", hoverString: "" };

    const excerptToDisplay = article.excerpt || "";
    const title = article.title || t("untitledArticle");
    const imageUrl = article.imageUrl;

    // =================== CARD STRUCTURE CORRECTION ===================
    // Card structure MUST be flex-col for consistent height. Grid handles layout.
    // Fixed image height, removed responsive width/height classes tied to sm:flex-row.
    const articleElement = document.createElement("article");
    articleElement.className = "article-card flex flex-col"; // Changed: Always flex-col, removed mb-6 (handled by grid gap)

    articleElement.innerHTML = `
          ${
            imageUrl
              ? `<a href="/article.html?id=${article.id}" class="block flex-shrink-0 group">
              <img src="${imageUrl}" alt="${title}" class="w-full h-48 object-cover group-hover:opacity-85 transition-opacity">  <!-- Changed: Fixed h-48, removed sm:* classes -->
             </a>`
              : `<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300 flex-shrink-0">No Image</div>` // Changed: Fixed h-48
          }
          <div class="p-4 md:p-5 lg:p-6 flex flex-col flex-grow"> <!-- Adjusted padding slightly -->
            <h2 class="text-lg md:text-xl font-semibold leading-snug text-gray-900 dark:text-white mb-2"> <!-- Adjusted text size -->
              <a href="/article.html?id=${article.id}" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                ${title}
              </a>
            </h2>
            <div class="flex flex-wrap items-center text-gray-500 dark:text-gray-400 text-sm mb-3 space-x-3"> <!-- Adjusted mb -->
              <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span>
              <span>•</span>
              <span class="${getCategoryBadgeClasses(article.category)}">${article.category || "Unknown"}</span>
              <span>•</span>
              <span class="flex items-center" title="${article.views ?? 0} views">
                  <i class="fi fi-rr-eye w-4 h-4 mr-1 text-gray-500 dark:text-gray-400 inline-block align-middle"></i>
                  ${article.views ?? 0}
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3 flex-grow mb-4"> <!-- Changed: text-sm, adjusted mb -->
              ${excerptToDisplay}
            </p>
            <div class="mt-auto pt-2 self-start"> <!-- mt-auto is key here -->
                <a href="/article.html?id=${article.id}"
                   class="btn btn-blue py-1.5 px-3 text-sm"> <!-- Adjusted padding slightly -->
                   ${t("readMore")}
                   <svg class="ms-2 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/></svg>
                </a>
            </div>
          </div>
      `;
    // ================= END CARD STRUCTURE CORRECTION =================

    container.appendChild(articleElement); // Append each article
  }); // End forEach loop

  // Optional: Translate any static text WITHIN the newly added cards if needed
  // translateStaticElements(); // Usually not needed if content is from API, but uncomment if labels inside cards need translation
}

// --- Single Article Page Initialization ---
async function initArticlePage() {
  console.log("--- initArticlePage START ---");
  const container = document.getElementById("article-container");
  const loadingIndicator = document.getElementById("article-loading");
  console.log("Container:", container ? "Found" : "MISSING");
  console.log("Loading Indicator:", loadingIndicator ? "Found" : "MISSING");

  if (!container) {
    console.error("Article container not found, cannot proceed.");
    return;
  }

  if (loadingIndicator) {
    console.log("Displaying loading indicator.");
    loadingIndicator.style.display = "block";
    container.innerHTML = "";
  } else {
    console.warn("Loading indicator element not found.");
    container.innerHTML = `<p class="p-6 text-center">${t("loadingArticles")}</p>`;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get("id");
    console.log("Raw articleId from URL:", articleId);

    if (
      !articleId ||
      isNaN(parseInt(articleId, 10)) ||
      parseInt(articleId, 10) <= 0
    ) {
      console.error(
        "articleId is missing or invalid AFTER parsing:",
        articleId,
      );
      const errorMsg =
        t("noArticleIdUrl") || "No valid article ID specified in the URL.";
      throw new Error(errorMsg);
    }
    const validArticleId = parseInt(articleId, 10);

    console.log(
      `Attempting to fetch article with ID: ${validArticleId}, Lang: ${currentLang}`,
    );

    const article = await getPublicArticleById(validArticleId, {
      lang: currentLang,
    });

    console.log(
      "API call completed. Fetched article data:",
      article ? `ID: ${article.id}` : "null/empty",
    );

    if (
      !article ||
      typeof article !== "object" ||
      Object.keys(article).length === 0
    ) {
      console.error("API returned null, undefined, or empty article object.");
      throw new Error(
        t("articleNotFound") ||
          "Article data not found or invalid response from API.",
      );
    }

    document.title = `${article.title || t("untitledArticle")} - MSKTF`;
    console.log("Calling renderArticle...");
    renderArticle(article, container);
  } catch (error) {
    console.error("--- CATCH block in initArticlePage:", error);

    const errorTitleKey = "errorLoadingArticleTitle";
    const generalError =
      t("errorLoadingArticleContent") || "Failed to load article content.";
    let displayMessage = error.message || generalError;

    // Simplify error message handling
    if (error.message && error.message.includes("404")) {
      displayMessage = t("articleNotFound") || "Article not found.";
    } else if (error.message && error.message.includes("No valid article ID")) {
      displayMessage =
        t("noArticleIdUrl") || "No valid article ID specified in the URL.";
    }

    container.innerHTML = `<div class="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 my-6" role="alert"><p class="font-bold">${t(errorTitleKey) || "Error Loading Article"}</p><p>${displayMessage}</p></div>`;
    document.title = `${t(errorTitleKey) || "Error Loading Article"} - MSKTF`;
  } finally {
    console.log("--- FINALLY block in initArticlePage ---");
    if (loadingIndicator) {
      console.log("Hiding loading indicator.");
      loadingIndicator.style.display = "none";
    }
  }
  console.log("--- initArticlePage END ---");
}

// --- Event Listener for DOM Ready ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("--- DOMContentLoaded event fired (articles.js) ---");
  console.log("--- Calling initializeUI() from articles.js listener ---");
  try {
    initializeUI();
    console.log("--- initializeUI() completed ---");
  } catch (e) {
    console.error("--- ERROR during initializeUI() call ---", e);
  }

  console.log("--- Checking for article-container ---");
  if (document.getElementById("article-container")) {
    console.log("--- Calling initArticlePage() from articles.js ---");
    initArticlePage();
  } else {
    console.log(
      "--- article-container not found (likely not single article page) ---",
    );
    // If it's not a single article page, articles-list.js should handle fetching the list.
    // This file (articles.js) primarily provides the rendering functions and logic for the single article page.
  }
  console.log("--- Event listener setup complete (articles.js) ---");
});

console.log("--- articles.js script FINISHED PARSING (End of File) ---");
