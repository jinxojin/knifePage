// client/src/articles.js

const API_URL = "http://localhost:3000/api";
const ARTICLE_ENDPOINT = `${API_URL}/articles`;

const articleCache = new Map();

export async function getArticleById(id) {
  try {
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
    throw error;
  }
}

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
    throw error;
  }
}

export function renderArticle(article, container) {
  const articleDate = new Date(article.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const articleHTML = `
        <article class="bg-white rounded-lg shadow-md overflow-hidden">
            ${
              article.imageUrl
                ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-auto">`
                : ""
            }
            <div class="p-6">
                <h1 class="text-3xl font-bold text-gray-900 mb-4">${
                  article.title
                }</h1>
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

export function renderArticleList(articles, container) {
  if (!articles || articles.length === 0) {
    container.innerHTML = `<p class="text-center py-4">No articles found.</p>`;
    return;
  }

  const articlesHTML = articles
    .map(
      (article) => `
      <article class="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          ${
            article.imageUrl
              ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover">`
              : ""
          }
          <div class="p-6">
              <h2 class="text-xl font-semibold text-gray-900 mb-2">
                  <a href="/article.html?id=${
                    article.id
                  }" class="hover:text-blue-600 transition-colors">
                      ${article.title}
                  </a>
              </h2>
              <div class="flex items-center text-gray-500 text-sm mb-3">
                  <span>${new Date(
                    article.createdAt,
                  ).toLocaleDateString()}</span>
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
      const article = await getArticleById(articleId);
      renderArticle(article, container);
    } else {
      const articles = await getArticlesByCategory("latest");
      renderArticleList(articles, container);
    }
  } catch (error) {
    container.innerHTML = `
            <div class="bg-red-50 border-l-4 border-red-500 p-4">
                <p class="text-red-700">${
                  error.message ||
                  "Failed to load article(s). Please try again later."
                }</p>
            </div>
        `;
  }
}

export function formatArticleDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function createArticleExcerpt(content, length = 150) {
  const plainText = content.replace(/<[^>]+>/g, "");
  return plainText.length > length
    ? `${plainText.substring(0, length)}...`
    : plainText;
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("article.html")) {
    initArticlePage();
  }
});

export const utils = {
  formatArticleDate,
  createArticleExcerpt,
};
