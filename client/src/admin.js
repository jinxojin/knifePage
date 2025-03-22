import "./style.css";

// --- DOM Elements ---
const loginForm = document.getElementById("login-form");
const articleForm = document.getElementById("article-form");
const articlesList = document.getElementById("articles-list");
const logoutButton = document.getElementById("logout-button");
const adminPanel = document.getElementById("admin-panel");
const loginPanel = document.getElementById("login-panel");

// --- API URL ---
const API_URL = "http://localhost:3000/api";

// --- Authentication ---
function isLoggedIn() {
  return localStorage.getItem("adminToken") !== null;
}

function updateUI() {
  if (isLoggedIn()) {
    loginPanel.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    fetchArticles();
  } else {
    loginPanel.classList.remove("hidden");
    adminPanel.classList.add("hidden");
  }
}

// --- Login Handler ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const messageElement = document.getElementById("login-message");

  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Login failed");

    localStorage.setItem("adminToken", data.token);
    messageElement.textContent = "Login successful!";
    messageElement.classList.remove("text-red-500");
    messageElement.classList.add("text-green-500");
    updateUI();
  } catch (err) {
    messageElement.textContent = `Error: ${err.message}`;
    messageElement.classList.remove("text-green-500");
    messageElement.classList.add("text-red-500");
  }
});

// --- Articles Management ---
async function fetchArticles() {
  try {
    const response = await fetch(`${API_URL}/articles`);
    const articles = await response.json();
    renderArticles(articles);
  } catch (err) {
    console.error("Error fetching articles:", err);
  }
}

function renderArticles(articles) {
  const container = document.getElementById("articles-container");
  container.innerHTML = articles
    .map(
      (article) => `
    <div class="bg-white p-4 rounded shadow mb-4 dark:bg-gray-700">
      <h3 class="text-lg font-bold">${article.title}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-300">Category: ${article.category}</p>
      <p class="text-sm text-gray-500 dark:text-gray-300">Author: ${article.author}</p>
      <div class="mt-4 flex space-x-2">
        <button class="edit-article bg-blue-500 text-white px-3 py-1 rounded" data-id="${article.id}">Edit</button>
        <button class="delete-article bg-red-500 text-white px-3 py-1 rounded" data-id="${article.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

  async function deleteArticle(articleId) {
    if (!confirm("Are you sure you want to delete this article?")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/articles/${articleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete article");
      }

      // Refresh the articles list
      fetchArticles();
    } catch (err) {
      console.error("Error deleting article:", err);
      alert(`Failed to delete article: ${err.message}`);
    }
  }
  // Add event listeners
  document.querySelectorAll(".edit-article").forEach((button) => {
    button.addEventListener("click", () =>
      loadArticleForEditing(button.dataset.id),
    );
  });

  document.querySelectorAll(".delete-article").forEach((button) => {
    button.addEventListener("click", () => deleteArticle(button.dataset.id));
  });
}

async function loadArticleForEditing(articleId) {
  try {
    const response = await fetch(`${API_URL}/articles/${articleId}`);
    const article = await response.json();

    document.getElementById("article-id").value = article.id;
    document.getElementById("article-title").value = article.title;
    tinymce.get("article-content").setContent(article.content);
    document.getElementById("article-category").value = article.category;
    document.getElementById("article-author").value = article.author;
    document.getElementById("article-image").value = article.imageUrl || "";

    document.getElementById("article-submit").textContent = "Update Article";
    document
      .getElementById("article-form-container")
      .classList.remove("hidden");
    articleForm.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    console.error("Error loading article:", err);
  }
}

// --- Form Handlers ---
articleForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const articleId = document.getElementById("article-id").value;
  const messageElement = document.getElementById("article-form-message");

  const articleData = {
    title: document.getElementById("article-title").value,
    content: tinymce.get("article-content").getContent(),
    category: document.getElementById("article-category").value,
    author: document.getElementById("article-author").value,
    imageUrl: document.getElementById("article-image").value,
  };

  try {
    const url = articleId
      ? `${API_URL}/admin/articles/${articleId}`
      : `${API_URL}/admin/articles`;

    const response = await fetch(url, {
      method: articleId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
      },
      body: JSON.stringify(articleData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    messageElement.textContent = `Article ${articleId ? "updated" : "created"} successfully!`;
    messageElement.classList.remove("text-red-500");
    messageElement.classList.add("text-green-500");

    // Reset form
    articleForm.reset();
    tinymce.get("article-content").setContent("");
    document.getElementById("article-id").value = "";
    document.getElementById("article-submit").textContent = "Create Article";

    fetchArticles();
  } catch (err) {
    messageElement.textContent = `Error: ${err.message}`;
    messageElement.classList.remove("text-green-500");
    messageElement.classList.add("text-red-500");
  }
});

// --- Event Listeners ---
document.getElementById("new-article-button").addEventListener("click", () => {
  articleForm.reset();
  tinymce.get("article-content").setContent("");
  document.getElementById("article-id").value = "";
  document.getElementById("article-submit").textContent = "Create Article";
  document.getElementById("article-form-message").textContent = "";
  document.getElementById("article-form-container").classList.remove("hidden");
  articleForm.scrollIntoView({ behavior: "smooth" });
});

document.getElementById("cancel-button").addEventListener("click", () => {
  articleForm.reset();
  tinymce.get("article-content").setContent("");
  document.getElementById("article-id").value = "";
  document.getElementById("article-submit").textContent = "Create Article";
  document.getElementById("article-form-message").textContent = "";
  document.getElementById("article-form-container").classList.add("hidden");
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("adminToken");
  updateUI();
});

// --- Initialize ---
document.addEventListener("DOMContentLoaded", updateUI);
