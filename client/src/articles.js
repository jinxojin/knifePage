// client/src/articles.js

// Constants for API endpoints and configuration
const API_URL = "http://localhost:3000/api"; // Centralized API URL
const ARTICLE_ENDPOINT = `${API_URL}/articles`;

// Cache for articles to improve performance
const articleCache = new Map();

/**
 * Fetches an article by ID
 * @param {string} id - The article ID
 * @returns {Promise<Object>} The article data
 * @throws {Error} If the article cannot be fetched
 */
export async function getArticleById(id) {
  try {
    // Check cache first
    if (articleCache.has(id)) {
      return articleCache.get(id);
    }
    const response = await fetch(`${ARTICLE_ENDPOINT}/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`);
    }

    const article = await response.json();
    articleCache.set(id, article);
    return article;
  } catch (error) {
    console.error("Error fetching article:", error);
    throw error; // Re-throw the error so the caller can handle it
  }
}

/**
 * Fetches articles by category
 * @param {string} category - The category to filter by
 * @returns {Promise<Array>} Array of articles
 * @throws {Error} If articles cannot be fetched
 */
export async function getArticlesByCategory(category) {
  try {
    const response = await fetch(`${ARTICLE_ENDPOINT}/category/${category}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch articles: ${response.statusText}`);
    }
    const articles = await response.json();
    return articles;
  } catch (error) {
    console.error("Error fetching articles by category:", error);
    throw error; // Re-throw for caller handling
  }
}

/**
 * Renders an article to the specified container
 * @param {Object} article - The article data
 * @param {HTMLElement} container - The container element
 */
export function renderArticle(article, container) {
  const articleDate = new Date(article.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const articleHTML = `
        <article class="bg-white rounded-lg shadow-md overflow-hidden">
            ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-auto">` : ""}
            <div class="p-6">
                <h1 class="text-3xl font-bold text-gray-900 mb-4">${article.title}</h1>
                <div class="flex items-center text-gray-500 text-sm mb-4">
                    <span>${articleDate}</span>
                    <span class="mx-2">•</span>
                    <span class="capitalize">${article.category}</span>
      </div>
                <div class="prose max-w-none">
          ${article.content}
        </div>
            </div>
      </article>
    `;

  container.innerHTML = articleHTML;
}

/**
 * Renders a list of articles
 * @param {Array} articles - Array of article objects
 * @param {HTMLElement} container - The container element
 */
export function renderArticleList(articles, container) {
  // Handle empty article list
  if (!articles || articles.length === 0) {
    container.innerHTML = `<p class="text-center py-4">No articles found.</p>`;
    return;
  }

  const articlesHTML = articles
    .map(
      (article) => `
      <article class="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover">` : ""}
          <div class="p-6">
              <h2 class="text-xl font-semibold text-gray-900 mb-2">
                  <a href="/article.html?id=${article.id}" class="hover:text-blue-600 transition-colors">
                      ${article.title}
                  </a>
              </h2>
              <div class="flex items-center text-gray-500 text-sm mb-3">
                  <span>${new Date(article.createdAt).toLocaleDateString()}</span>
                  <span class="mx-2">•</span>
                  <span class="capitalize">${article.category}</span>
              </div>
              <p class="text-gray-600 line-clamp-3">
                  ${createArticleExcerpt(article.content)}
              </p>
              <a href="/article.html?id=${article.id}"
                 class="inline-block mt-4 text-blue-600 hover:text-blue-800 transition-colors">
                  Read more →
              </a>
          </div>
      </article>
  `,
    )
    .join("");

  container.innerHTML = articlesHTML;
}

/**
 * Initializes the article page
 */
export async function initArticlePage() {
  const container = document.getElementById("article-container");
  const urlParams = new URLSearchParams(window.location.search);
  const articleId = urlParams.get("id");

  if (!container) {
    console.error("Article container not found");
    return;
  }

  try {
    if (articleId) {
      // Single article view
      const article = await getArticleById(articleId);
      renderArticle(article, container);
    } else {
      // List view - default to latest articles
      const articles = await getArticlesByCategory("latest");
      renderArticleList(articles, container);
    }
  } catch (error) {
    // Display a user-friendly error message
    container.innerHTML = `
            <div class="bg-red-50 border-l-4 border-red-500 p-4">
                <p class="text-red-700">${error.message || "Failed to load article(s). Please try again later."}</p>
            </div>
        `;
  }
}

/**
 * Formats the article date
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatArticleDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Creates article excerpt
 * @param {string} content - Article content
 * @param {number} length - Excerpt length
 * @returns {string} Article excerpt
 */
export function createArticleExcerpt(content, length = 150) {
  // Remove HTML tags and trim to length
  const plainText = content.replace(/<[^>]+>/g, "");
  return plainText.length > length
    ? `${plainText.substring(0, length)}...`
    : plainText;
}

// Initialize article functionality when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on an article page
  if (window.location.pathname.includes("article.html")) {
    initArticlePage();
  }
});

// Export utility functions for use in other modules
export const utils = {
  formatArticleDate,
  createArticleExcerpt,
};
