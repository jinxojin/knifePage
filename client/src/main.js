// client/src/main.js
console.log("--- main.js executing ---");

import "./style.css";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { enUS, ru, mn } from "date-fns/locale";
import { t, currentLang } from "./i18n.js";
import { initializeUI, translateStaticElements } from "./uiUtils.js";
import { getArticlesByCategorySlug } from "./apiService.js";

const dateLocales = { en: enUS, rus: ru, mng: mn };

const CATEGORIES = ["competition", "news", "blog"];

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
      return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300`;
  }
}
// --- END HELPER ---

function getConditionalTimestampStrings(dateObj) {
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
    console.error("Error processing date:", e);
    hoverString = "Invalid date";
  }
  return { displayString, hoverString };
}

function updateHighlightCard(category, article) {
  const container = document.getElementById(`highlight-${category}`);
  if (!container) {
    console.warn(`Highlight container not found for category: ${category}`);
    return;
  }

  if (!article) {
    container.innerHTML = `
            <div class="p-5 text-center">
                <h5 class="mb-2 text-xl font-medium text-gray-700 dark:text-gray-300">${t("noRecentArticle", { category })}</h5>
                <p class="text-gray-500 dark:text-gray-400">${t("checkBackLater")}</p>
            </div>`;
    return;
  }

  const excerptToDisplay = article.excerpt || "";
  const dateObj = new Date(article.createdAt);
  const { displayString, hoverString } =
    getConditionalTimestampStrings(dateObj);
  const title = article.title || t("untitledArticle");

  try {
    container.innerHTML = `
            <a href="/article.html?id=${article.id}" class="block group focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded-t-lg">
                <img class="rounded-t-lg object-cover w-full h-48 transition-opacity duration-300 group-hover:opacity-80" src="${article.imageUrl || "/assets/placeholder-image.jpg"}" alt="${title}" />
            </a>
            <div class="p-5 flex flex-col flex-grow">
                <div class="flex flex-wrap justify-between items-center text-gray-500 dark:text-gray-400 text-sm mb-3">
                    <span class="${getCategoryBadgeClasses(article.category)}">${article.category}</span>
                    <div class="flex items-center space-x-3">
                        <span title="${hoverString}">${displayString}</span>
                        <span class="flex items-center" title="${article.views ?? 0} views">
          <i class="fi fi-rr-eye w-4 h-4 mr-0.5 color-gray-500 dark:color-gray-400 inline-block align-middle"></i>
          ${article.views ?? 0}
      </span>
                    </div>
                </div>
                <a href="/article.html?id=${article.id}" class="block focus:outline-none">
                    <h5 class="text-xl font-semibold leading-snug tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 mb-1">
                        ${title}
                    </h5>
                </a>
                <p class="font-normal text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3 mb-3 flex-grow">
                    ${excerptToDisplay}
                </p>
                <div class="mt-auto pt-2 self-start">
                    <a href="/article.html?id=${article.id}"
                        class="btn btn-blue py-2 px-3 text-sm">
                        ${t("readMore")}
                        <svg class="ms-2 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/></svg>
                    </a>
                </div>
            </div>`;
  } catch (renderError) {
    console.error(`Error rendering card for ${category}:`, renderError);
    container.innerHTML = `<div class="p-5 text-center text-red-500">${t("errorLoadingData")}</div>`;
  }
}

async function initializePageContent() {
  console.log(`Initializing main page content in ${currentLang}...`);
  try {
    const articlePromises = CATEGORIES.map((category) =>
      getArticlesByCategorySlug(category, { lang: currentLang, limit: 1 })
        .then((articles) => articles[0] || null)
        .catch((error) => {
          console.error(
            `[Main Page] Failed to fetch highlight for ${category}:`,
            error,
          );
          const container = document.getElementById(`highlight-${category}`);
          if (container) {
            container.innerHTML = `<div class="p-5 text-center text-red-500">${t("errorLoadingData")}</div>`;
          }
          return null;
        }),
    );
    const articles = await Promise.all(articlePromises);
    CATEGORIES.forEach((category, index) => {
      const container = document.getElementById(`highlight-${category}`);
      // Ensure the container exists AND doesn't already show an error before updating
      if (container && !container.innerHTML.includes("text-red-500")) {
        // Add article-card class for hover effects if desired
        container.classList.add("article-card"); // Add class here
        updateHighlightCard(category, articles[index]);
      } else if (
        container &&
        articles[index] === null &&
        !container.innerHTML.includes("text-red-500")
      ) {
        // Handle case where fetch succeeded but returned no article
        updateHighlightCard(category, null); // Call with null to show 'no article' message
      }
    });
    console.log("Highlight cards updated (or errors shown).");
  } catch (error) {
    console.error("Error during main page initialization:", error);
  }
  console.log(`--- initializePageContent END`);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("--- DOMContentLoaded event fired (main.js) ---");
  console.log("--- Calling initializeUI() from main.js ---");
  initializeUI();
  console.log("--- Calling initializePageContent() from main.js ---");
  initializePageContent();
  console.log("--- Event listener setup complete (main.js) ---");
});
