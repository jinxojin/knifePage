// client/src/articles.js
import { formatDistanceToNow, format, differenceInHours } from "date-fns";

// --- Constants ---
const API_URL = "https://localhost:3000/api";
const ARTICLE_ENDPOINT = `${API_URL}/articles`;

// --- Cache ---
const articleCache = new Map();

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
 * @returns {Promise<object>} The article object.
 * @throws {Error} If fetching fails.
 */
export async function getArticleById(id) {
  try {
    // Optional: Check cache first
    // if (articleCache.has(id)) {
    //   return articleCache.get(id);
    // }

    const response = await fetch(`${ARTICLE_ENDPOINT}/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Article not found.`);
      }
      throw new Error(
        `Failed to fetch article: ${response.status} ${response.statusText}`,
      );
    }

    const article = await response.json();
    articleCache.set(id, article); // Update cache
    return article;
  } catch (error) {
    console.error(`Error fetching article ${id}:`, error);
    throw error; // Re-throw for the caller to handle
  }
}

/**
 * Fetches a list of articles, optionally filtered by category.
 * @param {string} category - The category to filter by.
 * @returns {Promise<Array<object>>} Array of article objects.
 * @throws {Error} If fetching fails.
 */
export async function getArticlesByCategory(category) {
  try {
    const response = await fetch(`${ARTICLE_ENDPOINT}/category/${category}`); // Using category specific endpoint

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
                    <!-- View count placeholder -->
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
                        <!-- View count placeholder -->
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
 * Initializes the article detail page: fetches and renders the article.
 */
export async function initArticlePage() {
  const container = document.getElementById("article-container");
  const loadingIndicator = document.getElementById("article-loading"); // Assumes you might add this ID to the pulse animation div
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
    const article = await getArticleById(articleId);
    document.title = `${article.title} - MSKTF`; // Set page title based on article
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

// --- Event Listener for Article Page ---
document.addEventListener("DOMContentLoaded", () => {
  // Only run initArticlePage if we are on a page with the article container
  if (document.getElementById("article-container")) {
    initArticlePage();
  }
});

// --- Exports ---
// No utils exported now as createArticleExcerpt was removed
// export const utils = {};
