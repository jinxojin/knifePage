import "./style.css";
import { fetchArticlesByCategory } from "./articles.js";

// --- DOM Elements ---
const elements = {
  loginForm: document.getElementById("login-form"),
  articleForm: document.getElementById("article-form"),
  articlesList: document.getElementById("articles-list"),
  logoutButton: document.getElementById("logout-button"),
  adminPanel: document.getElementById("admin-panel"),
  loginPanel: document.getElementById("login-panel"),
  newArticleButton: document.getElementById("new-article-button"),
  cancelButton: document.getElementById("cancel-button"),
  articleFormContainer: document.getElementById("article-form-container"),
  articleContent: document.getElementById("article-content"),
  editorContainer: document.getElementById("editor-container"),
  articleId: document.getElementById("article-id"),
  articleTitle: document.getElementById("article-title"),
  articleCategory: document.getElementById("article-category"),
  articleAuthor: document.getElementById("article-author"),
  articleImage: document.getElementById("article-image"),
  articleSubmit: document.getElementById("article-submit"),
  articleFormMessage: document.getElementById("article-form-message"),
  loginMessage: document.getElementById("login-message"),
  articlesContainer: document.getElementById("articles-container"),
};

// --- API URL ---
const API_URL = "http://localhost:3000/api";

// --- Quill Editor Setup ---
let quill;

// --- Authentication Functions ---
function isLoggedIn() {
  return localStorage.getItem("adminToken") !== null;
}

function updateUI() {
  if (isLoggedIn()) {
    elements.loginPanel.classList.add("hidden");
    elements.adminPanel.classList.remove("hidden");
    fetchArticles();
  } else {
    elements.loginPanel.classList.remove("hidden");
    elements.adminPanel.classList.add("hidden");
  }
}

// --- Article Management Functions ---
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
  elements.articlesContainer.innerHTML = articles
    .map(
      (article) => `
    <div class="bg-white p-4 rounded shadow mb-4 dark:bg-gray-700">
      <h3 class="text-lg font-bold">${article.title}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-300">Category: ${article.category}</p>
      <p class="text-sm text-gray-500 dark:text-gray-300">Author: ${article.author}</p>
      <div class="mt-4 flex space-x-2">
        <button class="edit-article btn btn-blue" data-id="${article.id}">Edit</button>
        <button class="delete-article btn btn-red" data-id="${article.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

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

    elements.articleId.value = article.id;
    elements.articleTitle.value = article.title;
    quill.root.innerHTML = article.content;
    elements.articleCategory.value = article.category;
    elements.articleAuthor.value = article.author;
    elements.articleImage.value = article.imageUrl || "";

    elements.articleSubmit.textContent = "Update Article";
    elements.articleFormContainer.classList.remove("hidden");
    elements.articleForm.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    console.error("Error loading article:", err);
  }
}

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

    fetchArticles();
  } catch (err) {
    console.error("Error deleting article:", err);
    alert(`Failed to delete article: ${err.message}`);
  }
}

function resetForm() {
  elements.articleForm.reset();
  quill.root.innerHTML = "";
  elements.articleId.value = "";
  elements.articleSubmit.textContent = "Create Article";
  elements.articleFormMessage.textContent = "";
}

// --- Event Handlers ---
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  loginUser(username, password);
}

async function loginUser(username, password) {
  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Login failed");

    localStorage.setItem("adminToken", data.token);
    elements.loginMessage.textContent = "Login successful!";
    elements.loginMessage.classList.remove("text-red-500");
    elements.loginMessage.classList.add("text-green-500");
    updateUI();
  } catch (err) {
    elements.loginMessage.textContent = `Error: ${err.message}`;
    elements.loginMessage.classList.remove("text-green-500");
    elements.loginMessage.classList.add("text-red-500");
  }
}

async function handleArticleSubmit(e) {
  e.preventDefault();

  const articleId = elements.articleId.value;

  const articleData = {
    title: elements.articleTitle.value,
    content: quill.root.innerHTML,
    category: elements.articleCategory.value,
    author: elements.articleAuthor.value,
    imageUrl: elements.articleImage.value,
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

    elements.articleFormMessage.textContent = `Article ${
      articleId ? "updated" : "created"
    } successfully!`;
    elements.articleFormMessage.classList.remove("text-red-500");
    elements.articleFormMessage.classList.add("text-green-500");

    resetForm();
    fetchArticles();
  } catch (err) {
    elements.articleFormMessage.textContent = `Error: ${err.message}`;
    elements.articleFormMessage.classList.remove("text-green-500");
    elements.articleFormMessage.classList.add("text-red-500");
  }
}

function handleNewArticleClick() {
  resetForm();
  elements.articleFormContainer.classList.remove("hidden");
  elements.articleForm.scrollIntoView({ behavior: "smooth" });
}

function handleCancelClick() {
  resetForm();
  elements.articleFormContainer.classList.add("hidden");
}

function handleLogout() {
  localStorage.removeItem("adminToken");
  updateUI();
}

// --- Initialize ---
function initializeApp() {
  // Initialize Quill if we're on the admin page
  if (elements.editorContainer) {
    quill = new Quill("#editor-container", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ color: [] }, { background: [] }],
          ["link", "image"],
          ["clean"],
        ],
      },
      placeholder: "Write your article content here...",
    });

    // Update hidden input when Quill content changes
    quill.on("text-change", function () {
      elements.articleContent.value = quill.root.innerHTML;
    });
  }

  // Add event listeners
  elements.loginForm?.addEventListener("submit", handleLogin);
  elements.articleForm?.addEventListener("submit", handleArticleSubmit);
  elements.newArticleButton?.addEventListener("click", handleNewArticleClick);
  elements.cancelButton?.addEventListener("click", handleCancelClick);
  elements.logoutButton?.addEventListener("click", handleLogout);

  updateUI();
}

document.addEventListener("DOMContentLoaded", initializeApp);
