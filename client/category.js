import "./style.css";

// --- API Service ---
const ApiService = {
  baseUrl: "https://localhost:3000/api",

  async getArticlesByCategory(category) {
    const response = await fetch(
      `${this.baseUrl}/articles?category=${category}`,
    );
    return response.json();
  },
};

// --- Category Page Controller ---
const CategoryController = {
  initialize() {
    // Get category from URL
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get("category");

    if (category) {
      this.loadCategoryArticles(category);
      // Update page title
      document.title = `${category.charAt(0).toUpperCase() + category.slice(1)} - MSKTF`;
      // Update heading
      const heading = document.querySelector("h1");
      if (heading) {
        heading.textContent =
          category.charAt(0).toUpperCase() + category.slice(1);
      }
    }
  },

  async loadCategoryArticles(category) {
    try {
      const articles = await ApiService.getArticlesByCategory(category);
      this.displayArticles(articles, "articles-container");
    } catch (error) {
      console.error(`Error loading ${category} articles:`, error);
    }
  },

  displayArticles(articles, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (articles.length === 0) {
      container.innerHTML =
        '<p class="text-center py-8">No articles found in this category.</p>';
      return;
    }

    container.innerHTML = articles
      .map(
        (article) => `
      <article class="article-card mb-6">
        ${
          article.imageUrl
            ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover mb-4 rounded">`
            : ""
        }
        <h2 class="text-xl font-bold mb-2">${article.title}</h2>
        <p class="text-sm text-gray-600 mb-2">By ${article.author}</p>
        <div class="prose prose-sm max-w-none mb-4">
          ${this.truncateHTML(article.content, 200)}...
        </div>
        <a href="/article.html?id=${
          article.id
        }" class="text-blue-600 hover:underline">Read more</a>
      </article>
    `,
      )
      .join("");
  },

  // Helper function to truncate HTML content safely
  truncateHTML(html, maxLength) {
    const div = document.createElement("div");
    div.innerHTML = html;
    const text = div.textContent || div.innerText || "";
    return text.substring(0, maxLength);
  },
};

// Initialize the category page
document.addEventListener("DOMContentLoaded", () => {
  CategoryController.initialize();
});
