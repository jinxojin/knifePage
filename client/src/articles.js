// client/src/articles.js
import { formatDistanceToNow, format, differenceInHours } from "date-fns";

// --- Constants ---
const API_URL = "https://localhost:3000/api";
const ARTICLE_ENDPOINT = `${API_URL}/articles`;
import { t, currentLang, setLanguage, supportedLangs } from './i18n.js'; // Import i18n functions

// --- Cache ---
const articleCache = new Map(); // Note: Cache doesn't currently consider language

// --- Language State (Handled by i18n.js) ---

// --- DOM Elements (for language selector on article page) ---
const languageBtn = document.getElementById("language-btn"); 
const languageDropdown = document.getElementById("language-dropdown");
const currentLangDisplay = document.getElementById("current-lang-display");

// --- Helper Functions ---

/**
 * Generates the display string and hover string for timestamps based on age.
 * @param {Date} dateObj - The date object for the article's creation time.
 * @returns {{displayString: string, hoverString: string}}
 */
function getConditionalTimestampStrings(dateObj) {
  let displayString = "Unknown date";
  let hoverString = "";
  const now = new Date();

  try {
    const hoursDifference = differenceInHours(now, dateObj);
    const fullDateFormat = format(dateObj, "do MMMM, yyyy"); // e.g., 26th March, 2025
    const relativeTimeFormat = formatDistanceToNow(dateObj, {
      addSuffix: true,
    }); // e.g., about 5 hours ago

    if (hoursDifference < 24) {
      // Less than 24 hours old: Display relative time, show full date on hover
      displayString = relativeTimeFormat;
      hoverString = fullDateFormat;
    } else {
      // 24 hours or older: Display full date, show relative time on hover
      displayString = fullDateFormat;
      hoverString = relativeTimeFormat;
    }
  } catch (e) {
    console.error(
      "Error processing date for conditional timestamp:",
      dateObj,
      e,
    );
    hoverString = "Invalid date"; // Provide fallback for hover
  }
  return { displayString, hoverString };
}

// --- API Fetching ---

/**
 * Fetches a single article by its ID from the API.
 * Uses a simple cache.
 * @param {string|number} id - The article ID.
 * @param {string|number} id - The article ID.
 * @param {string} lang - The language code.
 * @returns {Promise<object>} The article object.
 * @throws {Error} If fetching fails.
 */
export async function getArticleById(id, lang) { // Added lang parameter
  try {
    // Cache key could include language: const cacheKey = `${id}-${lang}`;
    // if (articleCache.has(cacheKey)) { return articleCache.get(cacheKey); }

    const response = await fetch(`${ARTICLE_ENDPOINT}/${id}?lang=${lang}`); // Added lang query param

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Article not found.`);
      }
      throw new Error(
        `Failed to fetch article: ${response.status} ${response.statusText}`,
      );
    }

    const article = await response.json();
    // articleCache.set(cacheKey, article); // Update cache with lang key
    return article;
  } catch (error) {
    console.error(`Error fetching article ${id}:`, error);
    throw error; // Re-throw for the caller to handle
  }
}

/**
 * Fetches a list of articles, optionally filtered by category.
 * @param {string} category - The category to filter by.
 * @param {string} category - The category to filter by.
 * @param {string} lang - The language code.
 * @returns {Promise<Array<object>>} Array of article objects.
 * @throws {Error} If fetching fails.
 */
export async function getArticlesByCategory(category, lang) { // Added lang parameter
  try {
    const response = await fetch(`${ARTICLE_ENDPOINT}/category/${category}?lang=${lang}`); // Added lang query param

    if (!response.ok) {
      throw new Error(
        `Failed to fetch articles: ${response.status} ${response.statusText}`,
      );
    }
    const articles = await response.json();
    return articles;
  } catch (error) {
    console.error(`Error fetching articles by category (${category}):`, error);
    throw error; // Re-throw
  }
}

// --- Rendering Functions ---

/**
 * Renders a single detailed article into the container.
 * @param {object} article - The article object.
 * @param {HTMLElement} container - The container element to render into.
 */
export function renderArticle(article, container) {
  const dateObj = new Date(article.createdAt);
  const { displayString, hoverString } =
    getConditionalTimestampStrings(dateObj);

  const articleHTML = `
        <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden">
            ${
              article.imageUrl
                ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-auto object-cover">`
                : ""
            }
            <div class="p-6">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">${article.title}</h1>
                <div class="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-4">
                    <span title="${hoverString}">${displayString}</span>
                    <span class="mx-2">•</span>
                    <span class="capitalize">${article.category}</span>
                    <span class="mx-2">•</span>
                    <span class="flex items-center">
                        <svg class="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg>
                        ${article.views ?? 0} views
                    </span>
                </div>
                <div class="prose dark:prose-invert max-w-none">
                    ${article.content}
                </div>
            </div>
        </article>
        `;
  container.innerHTML = articleHTML;
}

/**
 * Renders a list of article cards into the container.
 * @param {Array<object>} articles - Array of article objects.
 * @param {HTMLElement} container - The container element to render into.
 */
export function renderArticleList(articles, container) {
  if (!articles || articles.length === 0) {
    container.innerHTML = `<p class="text-center py-4">No articles found.</p>`;
    return;
  }

  const articlesHTML = articles
    .map((article) => {
      const dateObj = new Date(article.createdAt);
      const { displayString, hoverString } =
        getConditionalTimestampStrings(dateObj);

      // Use the excerpt field from the database, default to empty string
      const excerptToDisplay = article.excerpt || "";

      return `
            <article class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden mb-6">
                ${
                  article.imageUrl
                    ? `<a href="/article.html?id=${article.id}"><img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover"></a>`
                    : '<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300">No Image</div>'
                }
                <div class="p-6">
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        <a href="/article.html?id=${article.id}" class="hover:text-blue-600 transition-colors">
                            ${article.title}
                        </a>
                    </h2>
                    <div class="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-3">
                        <span title="${hoverString}">${displayString}</span>
                        <span class="mx-2">•</span>
                        <span class="capitalize">${article.category}</span>
                        <span class="mx-2">•</span>
                        <span class="flex items-center">
                            <svg class="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7a9.99 9.99 0 0 1-1.774 5.318A9.956 9.956 0 0 1 10 13.5a9.956 9.956 0 0 1-8.226-1.182A9.99 9.99 0 0 1 0 7a9.99 9.99 0 0 1 1.774-5.318A9.956 9.956 0 0 1 10 0.5a9.956 9.956 0 0 1 8.226 1.182A9.99 9.99 0 0 1 20 7Z"/></svg>
                            ${article.views ?? 0}
                        </span>
                    </div>
                    <p class="text-gray-600 dark:text-gray-300 line-clamp-3">
                        ${excerptToDisplay}
                    </p>
                    <a href="/article.html?id=${article.id}" class="inline-block mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                        Read more →
                    </a>
                </div>
            </article>
            `;
    })
    .join("");

  container.innerHTML = articlesHTML;
}

// --- Initialization ---

/**
 * Initializes the article detail page: fetches and renders the article in the current language.
 */
export async function initArticlePage() {
  console.log(`Initializing article page in ${currentLang}...`);
  // Update language display button
  if (currentLangDisplay) {
    currentLangDisplay.textContent = currentLang.toUpperCase();
  }
  // Translate static elements on this page too
  translateStaticElements(); 

  const container = document.getElementById("article-container");
  const loadingIndicator = document.getElementById("article-loading"); 
  const urlParams = new URLSearchParams(window.location.search);
  const articleId = urlParams.get("id");

  if (!container) {
    console.error("Article container not found");
    return;
  }
  if (loadingIndicator) loadingIndicator.style.display = "block"; // Show loading

  try {
    if (!articleId) {
      throw new Error("No article ID specified in the URL.");
    }
    // Fetch article using current language
    const article = await getArticleById(articleId, currentLang); 
    document.title = `${article.title} - MSKTF`; // Set page title based on fetched article title
    renderArticle(article, container);
  } catch (error) {
    container.innerHTML = `
            <div class="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4" role="alert">
                <p class="font-bold">Error Loading Article</p>
                <p>${error.message || "Failed to load article content. Please try again later."}</p>
            </div>
            `;
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none"; // Hide loading
  }
}

// --- Language Selector Logic (Copied from main.js, ensure elements exist) ---
function setupLanguageSelector() {
  if (!languageBtn || !languageDropdown) {
     console.warn("Language selector elements not found on this page.");
     return;
  }

  // Toggle dropdown visibility
  languageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    languageDropdown.classList.toggle('hidden');
  });

  // Handle language selection using setLanguage from i18n.js
  languageDropdown.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.dataset.lang) {
      e.preventDefault();
      const selectedLang = e.target.dataset.lang;
      setLanguage(selectedLang); // This handles localStorage and reload
      languageDropdown.classList.add('hidden'); // Hide dropdown after selection
    }
  });

  // Hide dropdown if clicking outside
  document.addEventListener('click', (e) => {
    if (!languageBtn.contains(e.target) && !languageDropdown.contains(e.target)) {
      languageDropdown.classList.add('hidden');
    }
  });
}

// --- Function to translate static elements (Similar to main.js, adjust selectors if needed) ---
function translateStaticElements() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const paramsAttr = element.getAttribute('data-i18n-params');
    let params = {};
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.error(`Error parsing i18n params for key "${key}":`, e);
      }
    }
     // Special handling for year in footer
    if (key === 'footerCopyright') {
      params.year = new Date().getFullYear();
    }

    if (element.hasAttribute('placeholder')) {
       element.placeholder = t(key, params);
    } else {
       element.textContent = t(key, params);
    }
  });

  // Update nav links (assuming same header structure as index.html)
   const navLinks = {
    '/': 'navHome', // Assuming index.html is '/'
    '/competitions.html': 'navCompetitions', // Match links in article.html header
    '/article.html': 'navNewsBlog', // This might need adjustment
    '/mission.html': 'navMission',
    '/contact.html': 'navContact',
    '/admin.html': 'navAdmin' // If admin link exists here too
  };
   document.querySelectorAll('header nav a').forEach(link => {
     // Get the filename from the href
     const href = link.getAttribute('href').split('/').pop(); // e.g., "index.html", "competitions.html"
     // Or handle root path explicitly
     const lookupHref = href === 'index.html' || href === '' ? '/' : href; 
     const key = navLinks[lookupHref];
    if (key) {
      link.textContent = t(key);
    }
  });

  // Translate footer elements if they exist on this page
  const aboutFooter = document.querySelector('footer h3:first-of-type'); // Adjust selector if needed
  if (aboutFooter) aboutFooter.textContent = t('footerAbout'); // Assuming 'footerAbout' key exists
  const linksFooter = document.querySelector('footer h3:nth-of-type(2)');
  if (linksFooter) linksFooter.textContent = t('footerLinks'); // Assuming 'footerLinks' key exists
  const contactFooter = document.querySelector('footer h3:last-of-type');
  if (contactFooter) contactFooter.textContent = t('footerContact'); // Assuming 'footerContact' key exists
  
  // Translate copyright - using data-i18n is better for this
  const copyrightFooter = document.querySelector('footer div[class*="border-t"] p');
  if (copyrightFooter) copyrightFooter.textContent = t('footerCopyright', { year: new Date().getFullYear() });

}


// --- Event Listener for Article Page ---
document.addEventListener("DOMContentLoaded", () => {
  setupLanguageSelector(); // Setup language dropdown on article page too
  // Only run initArticlePage if we are on a page with the article container
  if (document.getElementById("article-container")) {
    initArticlePage();
  }
  // Add logic here if this script is also used for category pages
});

// --- Exports ---
// No utils exported now as createArticleExcerpt was removed
// export const utils = {};
