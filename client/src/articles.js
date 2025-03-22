// src/articles.js
const API_URL = "http://localhost:3000/api";

async function fetchArticlesByCategory(category) {
  try {
    const response = await fetch(`${API_URL}/articles?category=${category}`);
    const articles = await response.json();
    return articles;
  } catch (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
}

function renderArticles(articles, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = articles
    .map(
      (article) => `
    <article class="mb-8">
      <h2 class="text-2xl font-bold mb-4">${article.title}</h2>
      ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="mb-4 rounded-lg">` : ""}
      <p class="text-gray-700 mb-4">${article.content}</p>
      <div class="text-sm text-gray-500">
        By ${article.author} | ${new Date(article.createdAt).toLocaleDateString()}
      </div>
    </article>
  `,
    )
    .join("");
}

// Add these to your HTML pages where needed:
document.addEventListener("DOMContentLoaded", () => {
  // For news & blog page
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

  // For competitions page
  if (document.getElementById("competitions-container")) {
    fetchArticlesByCategory("competitions").then((articles) =>
      renderArticles(articles, "competitions-container"),
    );
  }
});
