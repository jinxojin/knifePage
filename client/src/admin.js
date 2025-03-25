// client/src/admin.js
import "./style.css";

// --- API Service ---
const ApiService = {
  baseUrl: "http://localhost:3000/api",

  async login(username, password) {
    const url = `${this.baseUrl}/admin/login`;
    console.log("Login URL:", url);
    const body = JSON.stringify({ username, password });
    console.log("Login Body:", body);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
    });

    console.log("Login Response Status:", response.status);
    console.log("Login Response Headers:", response.headers);

    if (!response.ok) {
      const data = await response.json();
      console.log("Login Response Data (Error):", data);
      throw new Error(data.message || "Login failed");
    }

    const data = await response.json();
    console.log("Login Response Data (Success):", data);
    return data;
  },

  // --- Refresh Token Function ---
  async refreshToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      return null; // No refresh token
    }

    const response = await fetch(`${this.baseUrl}/admin/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      AuthService.clearTokens();
      throw new Error("Refresh token failed");
    }

    const data = await response.json();
    return data.accessToken;
  },

  async getArticles() {
    let accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      accessToken = await this.refreshToken();
      if (!accessToken) {
        AuthService.clearTokens();
        window.location.href = "/admin.html";
        return;
      }
      localStorage.setItem("accessToken", accessToken);
    }

    const response = await fetch(`${this.baseUrl}/articles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 403) {
      accessToken = await this.refreshToken();
      if (!accessToken) {
        AuthService.clearTokens();
        window.location.href = "/admin.html";
        return;
      }
      localStorage.setItem("accessToken", accessToken);

      const retryResponse = await fetch(`${this.baseUrl}/articles`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return retryResponse.json();
    } else if (!response.ok) {
      throw new Error(`Failed to fetch articles: ${response.status}`);
    }

    return response.json();
  },

  async getArticle(id) {
    const accessToken = localStorage.getItem("accessToken");
    const response = await fetch(`${this.baseUrl}/articles/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  },

  async createArticle(articleData) {
    const accessToken = localStorage.getItem("accessToken");
    const response = await fetch(`${this.baseUrl}/admin/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(articleData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to create article");
    }

    return response.json();
  },

  async updateArticle(id, articleData) {
    const accessToken = localStorage.getItem("accessToken");
    const response = await fetch(`${this.baseUrl}/admin/articles/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(articleData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to update article");
    }

    return response.json();
  },

  async deleteArticle(id) {
    const accessToken = localStorage.getItem("accessToken");
    const response = await fetch(`${this.baseUrl}/admin/articles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to delete article");
    }

    return true;
  },
};

// --- Auth Service ---
const AuthService = {
  isLoggedIn() {
    return localStorage.getItem("accessToken") !== null;
  },

  setTokens(accessToken, refreshToken) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  },

  clearTokens() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },
};

// --- UI Controller ---
const AdminUI = {
  elements: {
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
    articleId: document.getElementById("article-id"),
    articleTitle: document.getElementById("article-title"),
    articleCategory: document.getElementById("article-category"),
    articleAuthor: document.getElementById("article-author"),
    articleImage: document.getElementById("article-image"),
    articleSubmit: document.getElementById("article-submit"),
    articleFormMessage: document.getElementById("article-form-message"),
    loginMessage: document.getElementById("login-message"),
    articlesContainer: document.getElementById("articles-container"),
  },

  quill: null,

  initialize() {
    this.initQuillEditor();
    this.setupEventListeners();
    this.updateUI();
  },

  initQuillEditor() {
    if (document.getElementById("editor-container")) {
      this.quill = new Quill("#editor-container", {
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

      this.quill.on("text-change", () => {
        this.elements.articleContent.value = this.quill.root.innerHTML;
      });
    }
  },

  setupEventListeners() {
    this.elements.loginForm?.addEventListener(
      "submit",
      this.handleLogin.bind(this),
    );
    this.elements.articleForm?.addEventListener(
      "submit",
      this.handleArticleSubmit.bind(this),
    );
    this.elements.newArticleButton?.addEventListener(
      "click",
      this.handleNewArticleClick.bind(this),
    );
    this.elements.cancelButton?.addEventListener(
      "click",
      this.handleCancelClick.bind(this),
    );
    this.elements.logoutButton?.addEventListener(
      "click",
      this.handleLogout.bind(this),
    );
  },

  updateUI() {
    if (AuthService.isLoggedIn()) {
      this.elements.loginPanel.classList.add("hidden");
      this.elements.adminPanel.classList.remove("hidden");
      this.loadArticles();
    } else {
      this.elements.loginPanel.classList.remove("hidden");
      this.elements.adminPanel.classList.add("hidden");
    }
  },

  async loadArticles() {
    try {
      const articles = await ApiService.getArticles();
      this.renderArticles(articles);
    } catch (err) {
      console.error("Error loading articles:", err);
      this.elements.articlesContainer.innerHTML =
        "<p>Failed to load articles.</p>";
    }
  },

  renderArticles(articles) {
    this.elements.articlesContainer.innerHTML = articles
      .map(
        (article) => `
            <div class="article-card">
                <img src="${
                  article.imageUrl || "placeholder.jpg"
                }" alt="${article.title}" class="w-full h-48 object-cover rounded-t-lg">
                <div class="p-4">
                    <h3 class="text-lg font-bold">${article.title}</h3>
                    <p class="text-sm text-gray-500">Category: ${
                      article.category
                    }</p>
                      <p class="text-sm text-gray-500 dark:text-gray-300">Author: ${
                        article.author
                      }</p>
                    <div class="mt-2 flex space-x-2">
                        <button class="edit-article bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" data-id="${
                          article.id
                        }">Edit</button>
                        <button class="delete-article bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded" data-id="${
                          article.id
                        }">Delete</button>
                    </div>
                </div>
            </div>
        `,
      )
      .join("");

    document.querySelectorAll(".edit-article").forEach((button) => {
      button.addEventListener("click", () =>
        this.loadArticleForEditing(button.dataset.id),
      );
    });

    document.querySelectorAll(".delete-article").forEach((button) => {
      button.addEventListener("click", () =>
        this.handleDeleteArticle(button.dataset.id),
      );
    });
  },

  async loadArticleForEditing(articleId) {
    try {
      const article = await ApiService.getArticle(articleId);
      this.elements.articleId.value = article.id;
      this.elements.articleTitle.value = article.title;
      this.elements.articleContent.value = article.content;
      this.quill.root.innerHTML = article.content;
      this.elements.articleCategory.value = article.category;
      this.elements.articleAuthor.value = article.author;
      this.elements.articleImage.value = article.imageUrl || "";

      this.elements.articleSubmit.textContent = "Update Article";
      this.elements.articleFormContainer.classList.remove("hidden");
      this.elements.articleForm.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("Error loading article for editing:", err);
    }
  },

  resetForm() {
    this.elements.articleForm.reset();
    this.quill.root.innerHTML = "";
    this.elements.articleId.value = "";
    this.elements.articleSubmit.textContent = "Create Article";
    this.elements.articleFormMessage.textContent = "";
  },

  // Event Handlers
  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    console.log("--- handleLogin Start ---");
    console.log("Username (from input):", username);
    console.log("Password (from input):", password);

    try {
      const data = await ApiService.login(username, password);
      AuthService.setTokens(data.accessToken, data.refreshToken);

      this.elements.loginMessage.textContent = "Login successful!";
      this.elements.loginMessage.classList.remove("text-red-500");
      this.elements.loginMessage.classList.add("text-green-500");

      this.updateUI();
    } catch (err) {
      console.error("Login Error:", err);
      this.elements.loginMessage.textContent = `Error: ${err.message}`;
      this.elements.loginMessage.classList.remove("text-green-500");
      this.elements.loginMessage.classList.add("text-red-500");
    }
    console.log("--- handleLogin End ---");
  },

  async handleArticleSubmit(e) {
    e.preventDefault();

    const articleId = this.elements.articleId.value;
    const articleData = {
      title: this.elements.articleTitle.value,
      content: this.quill.root.innerHTML,
      category: this.elements.articleCategory.value,
      author: this.elements.articleAuthor.value,
      imageUrl: this.elements.articleImage.value,
    };

    try {
      if (articleId) {
        await ApiService.updateArticle(articleId, articleData);
        this.elements.articleFormMessage.textContent =
          "Article updated successfully!";
      } else {
        await ApiService.createArticle(articleData);
        this.elements.articleFormMessage.textContent =
          "Article created successfully!";
      }

      this.elements.articleFormMessage.classList.remove("text-red-500");
      this.elements.articleFormMessage.classList.add("text-green-500");

      this.resetForm();
      this.loadArticles();
    } catch (err) {
      this.elements.articleFormMessage.textContent = `Error: ${err.message}`;
      this.elements.articleFormMessage.classList.remove("text-green-500");
      this.elements.articleFormMessage.classList.add("text-red-500");
    }
  },

  async handleDeleteArticle(articleId) {
    if (!confirm("Are you sure you want to delete this article?")) {
      return;
    }

    try {
      await ApiService.deleteArticle(articleId);
      this.loadArticles();
    } catch (err) {
      console.error("Error deleting article:", err);
      alert(`Failed to delete article: ${err.message}`);
    }
  },

  handleNewArticleClick() {
    this.resetForm();
    this.elements.articleFormContainer.classList.remove("hidden");
    this.elements.articleForm.scrollIntoView({ behavior: "smooth" });
  },

  handleCancelClick() {
    this.resetForm();
    this.elements.articleFormContainer.classList.add("hidden");
  },

  handleLogout() {
    AuthService.clearTokens();
    this.updateUI();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  AdminUI.initialize();
});
