// client/src/article.js
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { enUS, ru, mn } from "date-fns/locale";
import { t, currentLang } from "./i18n.js";
import { initializeUI, translateStaticElements } from "./uiUtils.js";
import { getPublicArticleById } from "./apiService.js"; // Import from new apiService

// --- Keep Constants, Date Locales, Cache ---
const dateLocales = { en: enUS, rus: ru, mng: mn };
const articleCache = new Map(); // Cache could be removed if not deemed necessary

// --- Keep Helper Functions (Export if needed elsewhere) ---
export function getConditionalTimestampStrings(dateObj) {
  let displayString = "Unknown date";
  let hoverString = "";
  const now = new Date();
  const locale = dateLocales[currentLang] || enUS;
  try {
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
    console.error("Error processing date:", e);
    hoverString = "Invalid date";
  }
  return { displayString, hoverString };
}

// --- Keep Rendering Functions (Export if needed elsewhere) ---
export function renderArticle(article, container) {
  if (!article) {
    container.innerHTML = `<p class="text-red-500">${t("errorLoadingData")}</p>`;
    return;
  }
  const dateObj = new Date(article.createdAt);
  const { displayString, hoverString } =
    getConditionalTimestampStrings(dateObj);
  const title = article.title || t("untitledArticle");
  const articleHTML = ` <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden"> ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${title}" class="w-full h-auto max-h-96 object-cover">` : ""} <div class="p-6"> <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">${title}</h1> <div class="flex flex-wrap items-center text-gray-500 dark:text-gray-400 text-sm mb-4 space-x-2"> <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span> <span class="hidden sm:inline">•</span> <span class="capitalize whitespace-nowrap">${article.category}</span> <span class="hidden sm:inline">•</span> <span class="flex items-center whitespace-nowrap"> <svg class="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg> ${article.views ?? 0} views </span> </div> <div class="prose dark:prose-invert max-w-none mt-6"> ${article.content || `<p>${t("noContentAvailable")}</p>`} </div> </div> </article> `;
  container.innerHTML = articleHTML;
}

export function renderArticleList(articles, container) {
  if (!articles || articles.length === 0) {
    container.innerHTML = `<p class="text-center py-10">${t("noArticlesFound")}</p>`;
    return;
  }
  const articlesHTML = articles
    .map((article, index) => {
      if (!article) {
        console.warn(
          `[renderArticleList] Skipping invalid article at index ${index}`,
        );
        return "";
      }
      /* console.log(`[renderArticleList] Rendering article index ${index}:`, article); */ const dateObj =
        new Date(article.createdAt);
      const { displayString, hoverString } =
        getConditionalTimestampStrings(dateObj);
      const excerptToDisplay = article.excerpt || "";
      const title = article.title || t("untitledArticle");
      const imageUrl = article.imageUrl;
      return ` <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden mb-6 flex flex-col sm:flex-row"> ${imageUrl ? `<a href="/article.html?id=${article.id}" class="block sm:w-1/3 flex-shrink-0"> <img src="${imageUrl}" alt="${title}" class="w-full h-48 sm:h-full object-cover"> </a>` : '<div class="w-full sm:w-1/3 h-48 sm:h-auto bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300 flex-shrink-0">No Image</div>'} <div class="p-6 flex flex-col flex-grow"> <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2"> <a href="/article.html?id=${article.id}" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"> ${title} </a> </h2> <div class="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-3 space-x-2"> <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span> <span>•</span> <span class="capitalize whitespace-nowrap">${article.category}</span> <span>•</span> <span class="flex items-center whitespace-nowrap" title="${article.views ?? 0} views"> <svg class="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg> ${article.views ?? 0} </span> </div> <p class="text-gray-600 dark:text-gray-300 line-clamp-3 flex-grow"> ${excerptToDisplay} </p> <a href="/article.html?id=${article.id}" class="inline-block mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors self-start"> ${t("readMore")} → </a> </div> </article> `;
    })
    .join("");
  container.innerHTML = articlesHTML;
}

// --- UI Initialization (specific to article page) ---
async function initArticlePage() {
  console.log(`Initializing article page content in ${currentLang}...`);
  const container = document.getElementById("article-container");
  const loadingIndicator = document.getElementById("article-loading");
  const urlParams = new URLSearchParams(window.location.search);
  const articleId = urlParams.get("id");

  if (!container) {
    console.error("Article container not found");
    return;
  }
  if (loadingIndicator) loadingIndicator.style.display = "block";

  try {
    if (!articleId) {
      throw new Error(t("noArticleIdUrl"));
    }

    // Use new apiService function
    const article = await getPublicArticleById(articleId, {
      lang: currentLang,
    });

    document.title = `${article.title || t("untitledArticle")} - MSKTF`;
    renderArticle(article, container); // Use the existing render function
  } catch (error) {
    // Catch errors from apiService call
    console.error("Error in initArticlePage:", error);
    const errorTitleKey = "errorLoadingArticleTitle";
    const generalError = t("errorLoadingArticleContent");
    let displayMessage = error.message;
    if (
      error.message.includes("404") ||
      error.message.toLowerCase().includes("not found")
    ) {
      displayMessage = t("articleNotFound");
    } else if (error.message === t("noArticleIdUrl")) {
      displayMessage = t("noArticleIdUrl");
    } else if (!error.message) {
      displayMessage = generalError;
    }
    container.innerHTML = `<div class="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 my-6" role="alert"><p class="font-bold">${t(errorTitleKey)}</p><p>${displayMessage}</p></div>`;
    document.title = `${t(errorTitleKey)} - MSKTF`;
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}

// --- Event Listener for Article Page ---
document.addEventListener("DOMContentLoaded", () => {
  initializeUI(); // Setup header, footer, listeners, translate initial static elements
  // Only run article loading if container exists
  if (document.getElementById("article-container")) {
    initArticlePage();
  }
});
