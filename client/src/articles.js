// client/src/articles.js
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { enUS, ru, mn } from "date-fns/locale";
import { t, currentLang, setLanguage, supportedLangs } from "./i18n.js";

// --- Constants ---
const API_URL = "https://localhost:3000/api";
const ARTICLE_ENDPOINT = `${API_URL}/articles`;

// --- Cache ---
const articleCache = new Map();

// --- DOM Elements ---
const languageBtn = document.getElementById("language-btn");
const languageDropdown = document.getElementById("language-dropdown");

// Map language codes to date-fns locales
const dateLocales = {
  en: enUS,
  rus: ru,
  mng: mn,
};

// --- Helper Functions ---

/**
 * Generates the display string and hover string for timestamps based on age.
 * ADD export keyword here
 */
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
    console.error(
      "Error processing date for conditional timestamp:",
      dateObj,
      e,
    );
    hoverString = "Invalid date";
  }
  return { displayString, hoverString };
}

// --- API Fetching ---

/**
 * Fetches a single article by its ID from the API.
 * ADD export keyword here
 */
export async function getArticleById(id, lang) {
  const cacheKey = `${id}-${lang}`;
  if (articleCache.has(cacheKey)) {
    return articleCache.get(cacheKey);
  }

  try {
    const response = await fetch(`${ARTICLE_ENDPOINT}/${id}?lang=${lang}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Article not found.`);
      }
      let errorMsg = `Failed to fetch article: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMsg = `${errorMsg} - ${errorData.message || "Server error"}`;
      } catch (e) {
        /* Ignore */
      }
      throw new Error(errorMsg);
    }

    const article = await response.json();
    articleCache.set(cacheKey, article);
    return article;
  } catch (error) {
    console.error(`Error fetching article ${id} (${lang}):`, error);
    throw error;
  }
}

/**
 * Fetches articles by category (no pagination).
 * ADD export keyword here
 */
export async function getArticlesByCategory(category, lang, limit) {
  try {
    let url = `${ARTICLE_ENDPOINT}/category/${category}?lang=${lang}`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    const response = await fetch(url);

    if (!response.ok) {
      let errorMsg = `Failed to fetch articles: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMsg = `${errorMsg} - ${errorData.message || "Server error"}`;
      } catch (e) {
        /* Ignore */
      }
      throw new Error(errorMsg);
    }
    const articles = await response.json();
    return articles;
  } catch (error) {
    console.error(
      `Error fetching articles by category (${category}, ${lang}):`,
      error,
    );
    throw error;
  }
}

// --- Rendering Functions ---

/**
 * Renders a single detailed article.
 * ADD export keyword here
 */
export function renderArticle(article, container) {
  if (!article) {
    container.innerHTML = `<p class="text-red-500">${t("errorLoadingData")}</p>`;
    return;
  }
  const dateObj = new Date(article.createdAt);
  const { displayString, hoverString } =
    getConditionalTimestampStrings(dateObj);

  const articleHTML = `
        <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden">
            ${
              article.imageUrl
                ? `<img src="${article.imageUrl}" alt="${article.title || "Article image"}" class="w-full h-auto max-h-96 object-cover">`
                : ""
            }
            <div class="p-6">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">${article.title}</h1>
                <div class="flex flex-wrap items-center text-gray-500 dark:text-gray-400 text-sm mb-4 space-x-2">
                    <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span>
                    <span class="hidden sm:inline">•</span>
                    <span class="capitalize whitespace-nowrap">${article.category}</span>
                    <span class="hidden sm:inline">•</span>
                    <span class="flex items-center whitespace-nowrap">
                        <svg class="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg>
                        ${article.views ?? 0} views
                    </span>
                </div>
                <div class="prose dark:prose-invert max-w-none mt-6">
                    ${article.content || `<p>${t("noContentAvailable")}</p>`}
                </div>
            </div>
        </article>
        `;
  container.innerHTML = articleHTML;
}

/**
 * Renders a list of article cards.
 * ADD export keyword here
 */
export function renderArticleList(articles, container) {
  if (!articles || articles.length === 0) {
    container.innerHTML = `<p class="text-center py-10">${t("noArticlesFound")}</p>`;
    return;
  }

  const articlesHTML = articles
    .map((article) => {
      if (!article) return "";
      const dateObj = new Date(article.createdAt);
      const { displayString, hoverString } =
        getConditionalTimestampStrings(dateObj);
      const excerptToDisplay = article.excerpt || "";

      return `
            <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden mb-6 flex flex-col sm:flex-row">
                ${
                  article.imageUrl
                    ? `<a href="/article.html?id=${article.id}" class="block sm:w-1/3 flex-shrink-0">
                           <img src="${article.imageUrl}" alt="${article.title || "Article image"}" class="w-full h-48 sm:h-full object-cover">
                       </a>`
                    : '<div class="w-full sm:w-1/3 h-48 sm:h-auto bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300 flex-shrink-0">No Image</div>'
                }
                <div class="p-6 flex flex-col flex-grow">
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        <a href="/article.html?id=${article.id}" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            ${article.title || t("untitledArticle")}
                        </a>
                    </h2>
                    <div class="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-3 space-x-2">
                        <span title="${hoverString}" class="whitespace-nowrap">${displayString}</span>
                        <span>•</span>
                        <span class="capitalize whitespace-nowrap">${article.category}</span>
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

// --- UI Initialization ---

/**
 * Initializes the article detail page.
 * NO export needed here - only called internally on DOMContentLoaded
 */
/* export */ async function initArticlePage() {
  // REMOVED export
  console.log(`Initializing article page in ${currentLang}...`);
  translateStaticElements();

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
      throw new Error(t("noArticleIdUrl")); // Use translation key
    }
    const article = await getArticleById(articleId, currentLang);
    document.title = `${article.title || t("untitledArticle")} - MSKTF`;
    renderArticle(article, container);
  } catch (error) {
    console.error("Error in initArticlePage:", error);
    const errorTitleKey = "errorLoadingArticleTitle";
    const generalError = t("errorLoadingArticleContent");

    let displayMessage = error.message;
    // Use translated versions of specific errors
    if (error.message === "Article not found.") {
      displayMessage = t("articleNotFound");
    } else if (error.message === t("noArticleIdUrl")) {
      displayMessage = t("noArticleIdUrl");
    } else if (!error.message) {
      displayMessage = generalError;
    }

    container.innerHTML = `
            <div class="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 my-6" role="alert">
                <p class="font-bold">${t(errorTitleKey)}</p>
                <p>${displayMessage}</p>
            </div>
            `;
    document.title = `${t(errorTitleKey)} - MSKTF`;
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}

// --- Language Selector Logic ---
// Keep setupLanguageSelector function (no export needed)
function setupLanguageSelector() {
  // ... (implementation as before) ...
  if (!languageBtn || !languageDropdown) {
    console.warn("Language selector elements not found on this page.");
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
      const selectedLang = e.target.dataset.lang;
      setLanguage(selectedLang);
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
  const burgerBtn = document.getElementById("burger-btn");
  if (burgerBtn) {
    createMobileMenu();
  }
}

// --- Mobile Menu Logic ---
// Keep createMobileMenu function (no export needed)
function createMobileMenu() {
  // ... (implementation as before) ...
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
// Keep translateStaticElements function (no export needed)
function translateStaticElements() {
  // ... (implementation as before) ...
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const paramsAttr = element.getAttribute("data-i18n-params");
    let params = {};
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.error(`Error parsing i18n params for key "${key}":`, e);
      }
    }
    if (key === "footerCopyright") {
      params.year = new Date().getFullYear();
    }

    if (element.hasAttribute("placeholder")) {
      element.placeholder = t(key, params);
    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    } else {
      if (key === "footerCopyright") {
        element.innerHTML = t(key, params);
      } else {
        element.textContent = t(key, params);
      }
    }
  });
}

// --- Event Listener for Article Page ---
document.addEventListener("DOMContentLoaded", () => {
  setupLanguageSelector();
  // Only run initArticlePage if we are on a page meant to display a single article
  if (document.getElementById("article-container")) {
    initArticlePage();
  }
});

// --- Exports ---
// REMOVED the block export at the end
// Only functions explicitly marked with `export` above will be exported
