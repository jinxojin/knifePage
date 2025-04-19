// client/src/articles.js

// Log immediately to see if the script file itself is parsed/executed at all
console.log("--- articles.js script STARTING TO EXECUTE ---");

// Restore necessary imports
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { enUS, ru, mn } from "date-fns/locale";
import { t, currentLang } from "./i18n.js";
import { initializeUI, translateStaticElements } from "./uiUtils.js"; // Ensure this is imported
import { getPublicArticleById } from "./apiService.js"; // Ensure this is imported

// Define constants needed
const dateLocales = { en: enUS, rus: ru, mng: mn };

// Keep the export, body should be fine now
export function getConditionalTimestampStrings(dateObj) {
  console.log("--- getConditionalTimestampStrings called ---"); // Add log
  let displayString = "Unknown date";
  let hoverString = "";
  const now = new Date();
  const locale = dateLocales[currentLang] || enUS;
  try {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      throw new Error("Invalid date object received");
    }
    const hoursDifference = differenceInHours(now, dateObj);
    const fullDateFormat = format(dateObj, "PPP", { locale });
    const relativeTimeFormat = formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: locale,
    });
    if (hoursDifference < 24) {
      displayString = relativeTimeFormat;
      hoverString = fullDateFormat;
    } else {
      displayString = fullDateFormat;
      hoverString = relativeTimeFormat;
    }
  } catch (e) {
    console.error("Error processing date:", dateObj, e);
    hoverString = "Invalid date";
    displayString = "Invalid date";
  }
  return { displayString, hoverString };
}

// Keep the export, body should be fine now
export function renderArticle(article, container) {
  console.log("--- renderArticle START, article:", JSON.stringify(article));
  if (!article) {
    container.innerHTML = `<p class="text-red-500">${t("errorLoadingData")}</p>`;
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
    <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden">
      ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${title}" class="w-full h-auto max-h-96 object-cover">` : ""}
      <div class="p-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">${title}</h1>
        <div class="flex flex-wrap items-center text-gray-500 dark:text-gray-400 text-sm mb-4 space-x-2">
          <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span>
          <span class="hidden sm:inline">•</span>
          <span class="capitalize whitespace-nowrap">${article.category || "Unknown"}</span>
          <span class="hidden sm:inline">•</span>
          <span class="flex items-center whitespace-nowrap">
            <svg class="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg>
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

// Keep the export for articles-list.js
export function renderArticleList(articles, container) {
  console.log("--- renderArticleList called ---"); // Add log if needed
  if (!articles || articles.length === 0) {
    container.innerHTML = `<p class="text-center py-10">${t("noArticlesFound")}</p>`;
    return;
  }
  // ... (rest of original renderArticleList implementation) ...
  const articlesHTML = articles
    .map((article, index) => {
      if (!article) {
        console.warn(
          `[renderArticleList] Skipping invalid article at index ${index}`,
        );
        return "";
      }
      // Attempt to parse date, provide fallback if invalid
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
      return `
        <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden mb-6 flex flex-col sm:flex-row">
          ${imageUrl ? `<a href="/article.html?id=${article.id}" class="block sm:w-1/3 flex-shrink-0"> <img src="${imageUrl}" alt="${title}" class="w-full h-48 sm:h-full object-cover"> </a>` : '<div class="w-full sm:w-1/3 h-48 sm:h-auto bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300 flex-shrink-0">No Image</div>'}
          <div class="p-6 flex flex-col flex-grow">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              <a href="/article.html?id=${article.id}" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                ${title}
              </a>
            </h2>
            <div class="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-3 space-x-2">
              <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span>
              <span>•</span>
              <span class="capitalize whitespace-nowrap">${article.category || "Unknown"}</span>
              <span>•</span>
              <span class="flex items-center whitespace-nowrap" title="${article.views ?? 0} views">
                <svg class="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg>
                ${article.views ?? 0}
              </span>
            </div>
            <p class="text-gray-600 dark:text-gray-300 line-clamp-3 flex-grow">
              ${excerptToDisplay}
            </p>
            <a href="/article.html?id=${article.id}" class="inline-block mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors self-start">
              ${t("readMore")} →
            </a>
          </div>
        </article>
      `;
    })
    .join("");
  container.innerHTML = articlesHTML;
}

// *** UNCOMMENT THE BODY of initArticlePage ***
async function initArticlePage() {
  // --- Keep Logs ---
  console.log("--- initArticlePage START ---");
  const container = document.getElementById("article-container");
  const loadingIndicator = document.getElementById("article-loading");
  console.log("Container:", container ? "Found" : "MISSING");
  console.log("Loading Indicator:", loadingIndicator ? "Found" : "MISSING");

  const urlParams = new URLSearchParams(window.location.search);
  const articleId = urlParams.get("id");
  console.log("Raw articleId from URL:", articleId);
  // --- End Keep Logs ---

  if (!container) {
    console.error("Article container not found, cannot proceed.");
    return;
  }
  if (loadingIndicator) {
    console.log("Displaying loading indicator.");
    loadingIndicator.style.display = "block";
    container.innerHTML = ""; // Clear container while loading
  } else {
    console.warn("Loading indicator element not found.");
  }

  try {
    // --- Keep Logs ---
    console.log("Inside TRY block");
    if (
      !articleId ||
      isNaN(parseInt(articleId, 10)) ||
      parseInt(articleId, 10) <= 0
    ) {
      // Keep robust check
      console.error(
        "articleId is missing or invalid AFTER parsing:",
        articleId,
      );
      const errorMsg =
        typeof t === "function"
          ? t("noArticleIdUrl")
          : "No valid article ID specified in the URL.";
      throw new Error(errorMsg);
    }
    const validArticleId = parseInt(articleId, 10);
    console.log(
      `Attempting to fetch article with ID: ${validArticleId}, Lang: ${currentLang}`,
    );
    // --- End Keep Logs ---

    const article = await getPublicArticleById(validArticleId, {
      // Call the actual API function
      lang: currentLang,
    });

    // --- Keep Logs ---
    console.log(
      "API call completed. Fetched article data:",
      JSON.stringify(article),
    );
    if (
      !article ||
      typeof article !== "object" ||
      Object.keys(article).length === 0
    ) {
      // Keep robust check
      console.error("API returned null, undefined, or empty article object.");
      throw new Error("Article data not found or invalid response from API.");
    }
    // --- End Keep Logs ---

    document.title = `${article.title || (typeof t === "function" ? t("untitledArticle") : "Untitled Article")} - MSKTF`;
    console.log("Calling renderArticle...");
    renderArticle(article, container); // Render the fetched article
  } catch (error) {
    // --- Keep Logs ---
    console.error("--- CATCH block in initArticlePage:", error);
    // --- End Keep Logs ---
    const errorTitleKey = "errorLoadingArticleTitle";
    const generalError =
      typeof t === "function"
        ? t("errorLoadingArticleContent")
        : "Failed to load article content.";
    let displayMessage = error.message || generalError;

    if (error.message && error.message.includes("404")) {
      displayMessage =
        typeof t === "function" ? t("articleNotFound") : "Article not found.";
    } else if (
      error.message &&
      (error.message.includes("No valid article ID") ||
        error.message.includes("No article ID specified"))
    ) {
      displayMessage =
        typeof t === "function"
          ? t("noArticleIdUrl")
          : "No valid article ID specified in the URL.";
    }

    container.innerHTML = `<div class="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 my-6" role="alert"><p class="font-bold">${typeof t === "function" ? t(errorTitleKey) : "Error Loading Article"}</p><p>${displayMessage}</p></div>`;
    document.title = `${typeof t === "function" ? t(errorTitleKey) : "Error Loading Article"} - MSKTF`;
  } finally {
    // --- Keep Logs ---
    console.log("--- FINALLY block in initArticlePage ---");
    // --- End Keep Logs ---
    if (loadingIndicator) {
      console.log("Hiding loading indicator.");
      loadingIndicator.style.display = "none";
    }
  }
  // --- Keep Logs ---
  console.log("--- initArticlePage END ---");
  // --- End Keep Logs ---
}
// *** End of UNCOMMENTED initArticlePage body ***

// --- Event Listener for Article Page ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("--- DOMContentLoaded event fired (articles.js) ---");
  console.log("--- Calling initializeUI() from articles.js listener ---");
  try {
    initializeUI(); // Call this first
    console.log("--- initializeUI() completed ---");
  } catch (e) {
    console.error("--- ERROR during initializeUI() call ---", e);
  }

  console.log("--- Checking for article-container ---");
  if (document.getElementById("article-container")) {
    console.log("--- Calling initArticlePage() from articles.js ---");
    initArticlePage(); // Now call the full function
  } else {
    console.error("--- CRITICAL: article-container not found ---");
  }
  console.log("--- Event listener setup complete (articles.js) ---");
});

console.log("--- articles.js script FINISHED PARSING (End of File) ---");
