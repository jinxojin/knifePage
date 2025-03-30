// client/src/main.js
import "./style.css";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { enUS, ru, mn } from "date-fns/locale";
import { t, currentLang } from "./i18n.js"; // No need to import setLanguage here
// Import shared UI functions
import { setupLanguageSelector, translateStaticElements } from "./uiUtils.js";

// Map language codes to date-fns locales
const dateLocales = { en: enUS, rus: ru, mng: mn };

// --- Constants ---
const API_URL = "https://localhost:3000/api";
const CATEGORIES = ["competition", "news", "blog"];

// --- DOM Elements (specific to main page if any) ---
// Language/Burger buttons handled by uiUtils

// --- Helper Functions (specific to main page) ---
function getConditionalTimestampStrings(dateObj) {
  // ... (keep implementation as before) ...
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

// --- API Fetching (specific to main page) ---
async function fetchLatestArticle(category, lang) {
  try {
    const response = await fetch(
      `${API_URL}/articles/category/${category}?limit=1&lang=${lang}`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`No articles found for category: ${category}`);
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const articles = await response.json();
    return articles[0] || null;
  } catch (error) {
    console.error(`Error fetching latest ${category} article:`, error);
    return null;
  }
}

// --- Rendering Functions (specific to main page) ---
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
  const title = article.title || t("untitledArticle"); // Use fallback

  try {
    container.innerHTML = `
            <a href="/article.html?id=${article.id}" class="block group focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded-t-lg">
                <img class="rounded-t-lg object-cover w-full h-48 transition-opacity duration-300 group-hover:opacity-80" src="${article.imageUrl || "/assets/placeholder-image.jpg"}" alt="${title}" />
            </a>
            <div class="p-5">
                <div class="flex justify-between items-center text-gray-500 dark:text-gray-400 text-xs mb-2">
                    <span class="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded text-xs font-medium capitalize">${article.category}</span>
                    <div class="flex items-center space-x-2">
                        <span title="${hoverString}">${displayString}</span>
                        <span class="flex items-center" title="${article.views ?? 0} views">
                            <svg class="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg>
                            ${article.views ?? 0}
                        </span>
                    </div>
                </div>
                <a href="/article.html?id=${article.id}" class="block focus:outline-none">
                    <h5 class="mb-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                        ${title}
                    </h5>
                </a>
                <p class="mb-4 font-normal text-gray-700 dark:text-gray-300 line-clamp-3">
                    ${excerptToDisplay}
                </p>
                <div class="flex justify-between items-center mt-4">
                    <a href="/article.html?id=${article.id}"
                        class="bg-primary-700 dark:bg-primary-600 inline-flex items-center rounded-lg px-3 py-2 text-center text-sm font-medium text-white hover:bg-primary-800 dark:hover:bg-primary-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 focus:outline-none transition-colors duration-200">
                        ${t("readMore")}
                        <svg class="ms-2 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/></svg>
                    </a>
                </div>
            </div>`;
  } catch (renderError) {
    console.error(`Error rendering card for ${category}:`, renderError);
  }
}

// --- UI Initialization (specific to main page) ---
async function initializePage() {
  console.log(`Initializing main page in ${currentLang}...`);
  // Translate static elements FIRST using the imported function
  translateStaticElements();

  // Fetch dynamic content
  try {
    const articlePromises = CATEGORIES.map((category) =>
      fetchLatestArticle(category, currentLang),
    );
    const articles = await Promise.all(articlePromises);
    CATEGORIES.forEach((category, index) => {
      updateHighlightCard(category, articles[index]);
    });
    console.log("Highlight cards updated.");
  } catch (error) {
    console.error("Error during main page initialization:", error);
    // Optionally display a general error message on the page
  }
}

// --- Global Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  // Setup language selector and mobile menu using the imported function
  setupLanguageSelector();
  // Initialize page content (which also calls translateStaticElements)
  initializePage();
});
