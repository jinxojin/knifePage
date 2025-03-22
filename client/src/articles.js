// src/articles.js
const API_URL = "http://localhost:3000/api";

async function fetchArticlesByCategory(category, limit = null) {
  try {
    let url = `${API_URL}/articles?category=${category}`;
    if (limit) url += `&limit=${limit}`;

    const response = await fetch(url);
    const articles = await response.json();
    return articles;
  } catch (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
}

async function fetchArticleById(id) {
  try {
    const response = await fetch(`${API_URL}/articles/${id}`);
    const article = await response.json();
    return article;
  } catch (error) {
    console.error("Error fetching article:", error);
    return null;
  }
}

function renderArticles(articles, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (articles.length === 0) {
    container.innerHTML =
      '<p class="text-center py-4">No articles available at this time.</p>';
    return;
  }

  container.innerHTML = articles
    .map(
      (article) => `
    <article class="bg-white p-4 rounded shadow mb-4 dark:bg-gray-700">
      <h2 class="text-2xl font-bold mb-2">${article.title}</h2>
      ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover mb-4 rounded">` : ""}
      <div class="prose prose-sm max-w-none mb-4">
        ${truncateHTML(article.content, 150)}...
      </div>
      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-500 dark:text-gray-300">
          By ${article.author} | ${new Date(article.createdAt).toLocaleDateString()}
        </div>
        <a href="/article.html?id=${article.id}" class="text-blue-600 hover:underline">Read more</a>
      </div>
    </article>
  `,
    )
    .join("");
}

function renderLatestArticles() {
  // For homepage - fetch latest from each category
  Promise.all([
    fetchArticlesByCategory("news", 1),
    fetchArticlesByCategory("blogs", 1),
    fetchArticlesByCategory("competitions", 1),
  ]).then(([news, blogs, competitions]) => {
    if (document.getElementById("latest-news")) {
      renderArticles(news, "latest-news");
    }

    if (document.getElementById("latest-blogs")) {
      renderArticles(blogs, "latest-blogs");
    }

    if (document.getElementById("latest-competitions")) {
      renderArticles(competitions, "latest-competitions");
    }
  });
}

function renderSingleArticle(articleId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  fetchArticleById(articleId).then((article) => {
    if (!article) {
      container.innerHTML = '<p class="text-center py-8">Article not found</p>';
      return;
    }

    container.innerHTML = `
      <article class="bg-white p-6 rounded shadow dark:bg-gray-700">
        <h1 class="text-3xl font-bold mb-2">${article.title}</h1>
        <div class="text-sm text-gray-500 dark:text-gray-300 mb-6">
          By ${article.author} | ${new Date(article.createdAt).toLocaleDateString()} | Category: ${article.category}
        </div>
        
        ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full max-h-96 object-cover mb-6 rounded">` : ""}
        
        <div class="prose prose-lg max-w-none">
          ${article.content}
        </div>
      </article>
    `;
  });
}

// Helper function to truncate HTML content safely
function truncateHTML(html, maxLength) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent || div.innerText || "";
  return text.substring(0, maxLength);
}

// Initialize based on page
document.addEventListener("DOMContentLoaded", () => {
  // For category pages
  if (document.getElementById("news-container")) {
    fetchArticlesByCategory("news").then((articles) =>
      renderArticles(articles, "news-container"),
    );
  }

  if (document.getElementById("blogs-container")) {
    fetchArticlesByCategory("blogs").then((articles) =>
      renderArticles(articles, "blogs-container"),
    );
  }

  if (document.getElementById("competitions-container")) {
    fetchArticlesByCategory("competitions").then((articles) =>
      renderArticles(articles, "competitions-container"),
    );
  }

  // For homepage
  if (
    document.getElementById("latest-news") ||
    document.getElementById("latest-blogs") ||
    document.getElementById("latest-competitions")
  ) {
    renderLatestArticles();
  }

  // For single article page
  if (document.getElementById("article-container")) {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get("id");
    if (articleId) {
      renderSingleArticle(articleId, "article-container");
    }
  }
});

// Export functions for use in other files
export { fetchArticlesByCategory, renderArticles };
