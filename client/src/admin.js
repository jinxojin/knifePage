// client/src/admin.js
import "./style.css";

// --- API Service ---
const ApiService = {
  baseUrl: "https://localhost:3000/api",
  csrfToken: null, // Store the CSRF token

  /**
   * Fetches the CSRF token from the server and stores it.
   * @returns {Promise<string>} The fetched CSRF token.
   * @throws {Error} If fetching the token fails.
   */
  async fetchCsrfToken() {
    try {
      const response = await fetch(`${this.baseUrl}/csrf-token`, {
        credentials: "include", // Send cookies (needed for CSRF check)
      });
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            `Failed to fetch CSRF token: ${response.status} Too Many Requests. Please wait and try again.`,
          );
        }
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      const data = await response.json();
      this.csrfToken = data.csrfToken; // Store token
      return this.csrfToken;
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      throw error;
    }
  },

  /**
   * Makes a generic API request, handling CSRF token and authorization.
   * Automatically retries once if a CSRF token error occurs.
   * @param {string} url - The full URL for the API endpoint.
   * @param {string} [method='GET'] - The HTTP method.
   * @param {object|null} [data=null] - The data payload for POST/PUT requests.
   * @param {boolean} [isRetry=false] - Flag to prevent infinite retry loops.
   * @returns {Promise<object|array|null>} The parsed JSON response, or null for non-JSON responses.
   * @throws {Error} If the request fails or returns a non-OK status.
   */
  async makeRequest(url, method = "GET", data = null, isRetry = false) {
    // Fetch CSRF token if needed
    if (
      !this.csrfToken &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase()) &&
      !isRetry
    ) {
      try {
        await this.fetchCsrfToken();
      } catch (csrfError) {
        console.error("Failed to pre-fetch CSRF token:", csrfError);
      }
    }

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
    };
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    if (
      this.csrfToken &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())
    ) {
      headers["x-csrf-token"] = this.csrfToken;
    }

    // Prepare fetch options
    const options = {
      method: method.toUpperCase(),
      headers,
      credentials: "include",
    };
    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // CSRF Token Retry Logic
      if (response.status === 403 && !isRetry) {
        try {
          const errorJson = await response.clone().json();
          if (
            errorJson.message &&
            errorJson.message.toLowerCase() === "invalid csrf token"
          ) {
            console.warn(
              "CSRF token invalid, fetching new token and retrying ONCE...",
            );
            this.csrfToken = null;
            await this.fetchCsrfToken();
            return this.makeRequest(url, method, data, true); // Retry ONCE
          }
        } catch (e) {
          console.error(
            "Could not parse potential CSRF error response body:",
            e,
          );
        }
      }

      // Handle No Content success response
      if (response.status === 204) {
        console.log(`Received 204 No Content for ${method} ${url}`);
        return null; // Indicate success with no body
      }

      // Check if response is ok after potential retry
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `Request failed with status ${response.status} ${response.statusText}`,
        }));
        const errors = errorData.errors;
        const errorMessage =
          errorData.message || `Request failed: ${response.status}`;
        console.error(`Request failed: ${response.status}`, errorData);
        const error = new Error(errorMessage);
        if (errors) {
          error.errors = errors;
        }
        throw error;
      }

      // Handle JSON response
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const responseData = await response.json();
        return responseData; // Can be an object or an array
      } else {
        console.log(
          `Received non-JSON response for ${method} ${url} (Status: ${response.status})`,
        );
        return await response.text(); // Return text for non-JSON responses
      }
    } catch (networkError) {
      console.error(
        `Network or API error during ${method} request to ${url}:`,
        networkError,
      );
      if (networkError.errors) {
        throw networkError;
      }
      throw new Error(
        networkError.message || `Network error during ${method} request.`,
      );
    }
  },

  // --- Specific API Calls ---

  async login(username, password) {
    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/admin/login`,
        "POST",
        { username, password },
      );
      return data;
    } catch (error) {
      console.error("Login Error (caught in login method):", error);
      throw error;
    }
  },

  async refreshToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/admin/refresh`,
        "POST",
        { refreshToken },
      );
      return data.accessToken;
    } catch (error) {
      console.error("Refresh token failed:", error);
      AuthService.clearTokens();
      throw error;
    }
  },

  /** Handles API calls requiring auth, includes token refresh logic */
  async makeAuthenticatedRequest(url, method = "GET", data = null) {
    try {
      return await this.makeRequest(url, method, data);
    } catch (error) {
      if (
        error.message.includes("401") ||
        error.message.includes("Forbidden") ||
        error.message.includes("403")
      ) {
        console.warn(
          `Authorization error on ${method} ${url}, attempting token refresh...`,
        );
        try {
          const newAccessToken = await this.refreshToken();
          if (newAccessToken) {
            localStorage.setItem("accessToken", newAccessToken);
            console.log(`Retrying ${method} ${url} with new token.`);
            return await this.makeRequest(url, method, data); // Retry ONCE with new token
          } else {
            console.error(
              "Token refresh failed or not possible. Clearing session.",
            );
            AuthService.clearTokens();
            window.location.href = "/admin.html";
            throw new Error("Session expired. Please log in again.");
          }
        } catch (refreshError) {
          console.error("Error during token refresh attempt:", refreshError);
          AuthService.clearTokens();
          window.location.href = "/admin.html";
          throw new Error("Session expired. Please log in again.");
        }
      } else {
        console.error(`Non-authorization error on ${method} ${url}:`, error);
        throw error; // Re-throw other errors
      }
    }
  },

  // ========== OPTION A: Call /api/articles/all ==========
  async getArticles() {
    // Use makeAuthenticatedRequest which handles auth and token refresh
    // Call the endpoint that returns a direct array of all articles
    return this.makeAuthenticatedRequest(`${this.baseUrl}/articles/all`);
  },
  // ======================================================

  async getArticle(id) {
    // Use makeAuthenticatedRequest
    // This endpoint fetches details for a single article
    return this.makeAuthenticatedRequest(`${this.baseUrl}/articles/${id}`);
  },

  async createArticle(articleData) {
    // Use makeAuthenticatedRequest (handles auth, token refresh, CSRF)
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles`,
      "POST",
      articleData,
    );
  },

  async updateArticle(id, articleData) {
    // Use makeAuthenticatedRequest
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles/${id}`,
      "PUT",
      articleData,
    );
  },

  async deleteArticle(id) {
    // Use makeAuthenticatedRequest
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles/${id}`,
      "DELETE",
    );
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
    ApiService.csrfToken = null;
    console.log("Tokens cleared from localStorage and ApiService.");
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
    formHeading: document.getElementById("form-heading"),
    articleTitle_en: document.getElementById("article-title-en"),
    editorContainer_en: document.getElementById("editor-container-en"),
    articleContent_en: document.getElementById("article-content-en"),
    articleExcerpt_en: document.getElementById("article-excerpt-en"),
    articleTitle_rus: document.getElementById("article-title-rus"),
    editorContainer_rus: document.getElementById("editor-container-rus"),
    articleContent_rus: document.getElementById("article-content-rus"),
    articleExcerpt_rus: document.getElementById("article-excerpt-rus"),
    articleTitle_mng: document.getElementById("article-title-mng"),
    editorContainer_mng: document.getElementById("editor-container-mng"),
    articleContent_mng: document.getElementById("article-content-mng"),
    articleExcerpt_mng: document.getElementById("article-excerpt-mng"),
    articleId: document.getElementById("article-id"),
    articleCategory: document.getElementById("article-category"),
    articleAuthor: document.getElementById("article-author"),
    articleImage: document.getElementById("article-image"),
    articleSubmit: document.getElementById("article-submit"),
    articleFormMessage: document.getElementById("article-form-message"),
    loginMessage: document.getElementById("login-message"),
    articlesContainer: document.getElementById("articles-container"),
  },

  quillInstances: { en: null, rus: null, mng: null },

  initialize() {
    this.initQuillEditor();
    this.setupEventListeners();
    this.updateUI();
  },

  initQuillEditor() {
    const toolbarOptions = [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "image"],
      ["clean"],
    ];
    const initializeInstance = (lang) => {
      const container = this.elements[`editorContainer_${lang}`];
      const hiddenInput = this.elements[`articleContent_${lang}`];
      if (container && hiddenInput) {
        try {
          this.quillInstances[lang] = new Quill(container, {
            theme: "snow",
            modules: { toolbar: toolbarOptions },
            placeholder: `Write ${lang.toUpperCase()} content here...`,
          });
          this.quillInstances[lang].on("text-change", () => {
            hiddenInput.value = this.quillInstances[lang].root.innerHTML;
          });
        } catch (error) {
          console.error(`Failed to initialize Quill for ${lang}:`, error);
          this.displayMessage(
            this.elements.articleFormMessage,
            `Failed to load ${lang.toUpperCase()} text editor.`,
            true,
          );
        }
      } else {
        console.warn(`Quill container/input not found for language: ${lang}`);
      }
    };
    initializeInstance("en");
    initializeInstance("rus");
    initializeInstance("mng");
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
    const loggedIn = AuthService.isLoggedIn();
    if (loggedIn) {
      this.elements.loginPanel?.classList.add("hidden");
      this.elements.adminPanel?.classList.remove("hidden");
      this.loadArticles();
    } else {
      this.elements.loginPanel?.classList.remove("hidden");
      this.elements.adminPanel?.classList.add("hidden");
      if (this.elements.articlesContainer)
        this.elements.articlesContainer.innerHTML = "";
      if (this.elements.articleFormContainer)
        this.elements.articleFormContainer.classList.add("hidden");
    }
  },

  async loadArticles() {
    if (!this.elements.articlesContainer) return;
    this.elements.articlesContainer.innerHTML =
      '<p class="text-center p-4 col-span-full">Loading articles...</p>';
    try {
      // This now calls /api/articles/all and should receive an ARRAY
      const articlesArray = await ApiService.getArticles();

      // Check if the response is an array
      if (!Array.isArray(articlesArray)) {
        console.error(
          "[Admin] ApiService.getArticles (from /all) did not return an array:",
          articlesArray,
        );
        throw new Error(
          "Received unexpected data format when fetching articles list.",
        );
      }

      console.log("[Admin] Received articles from /all:", articlesArray);
      this.renderArticles(articlesArray); // Pass the array
    } catch (err) {
      console.error("[Admin] Error loading articles in loadArticles:", err);
      this.elements.articlesContainer.innerHTML = `<p class="text-red-500 text-center p-4 col-span-full">Failed to load articles: ${err.message}</p>`;
    }
  },

  renderArticles(articles) {
    // Expects an array
    if (!this.elements.articlesContainer) return;

    // Ensure articles is an array
    if (!Array.isArray(articles)) {
      console.error("[Admin] renderArticles received non-array:", articles);
      this.elements.articlesContainer.innerHTML =
        "<p class='text-red-500 text-center p-4 col-span-full'>Error: Invalid article data received.</p>";
      return;
    }

    if (articles.length === 0) {
      this.elements.articlesContainer.innerHTML =
        "<p class='text-center p-4 col-span-full'>No articles found.</p>";
      return;
    }

    this.elements.articlesContainer.innerHTML = articles
      .map((article) => {
        // Basic check for valid article object structure
        if (!article || typeof article !== "object" || !article.id) {
          console.warn(
            "[Admin] Skipping invalid article object in map:",
            article,
          );
          return ""; // Skip rendering this item
        }
        // Safely access properties with fallbacks
        const title = article.title || article.title_en || "Untitled"; // Use specific language or fallback
        const category = article.category || "uncategorized";
        const author = article.author || "Unknown Author";
        const imageUrl = article.imageUrl;
        const status = article.status || "unknown"; // Get status

        return `
            <div class="article-card border dark:border-gray-600 rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-700 flex flex-col">
                ${
                  imageUrl
                    ? `<img src="${imageUrl}" alt="${title}" class="w-full h-48 object-cover">`
                    : '<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300">No Image</div>'
                }
                <div class="p-4 flex flex-col flex-grow">
                    <h3 class="text-lg font-bold mb-1 dark:text-white flex-grow">${title}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Category: ${category}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Author: ${author}</p>
                    {/* Display status */}
                    <p class="text-sm font-medium ${status === "published" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"} mb-2 capitalize">Status: ${status}</p>

                    <div class="mt-auto pt-2 flex space-x-2">
                        <button class="edit-article btn btn-blue text-sm py-1 px-3" data-id="${article.id}">Edit</button>
                        <button class="delete-article btn btn-red text-sm py-1 px-3" data-id="${article.id}">Delete</button>
                    </div>
                </div>
            </div>
          `;
      })
      .join("");

    // Re-attach event listeners
    this.elements.articlesContainer
      .querySelectorAll(".edit-article")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const id = e.currentTarget.dataset.id;
          this.loadArticleForEditing(id);
        });
      });
    this.elements.articlesContainer
      .querySelectorAll(".delete-article")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const id = e.currentTarget.dataset.id;
          this.handleDeleteArticle(id);
        });
      });
  },

  async loadArticleForEditing(articleId) {
    if (!this.elements.articleFormContainer || !this.elements.articleForm)
      return;
    this.displayMessage(
      this.elements.articleFormMessage,
      "Loading article data...",
      false,
    );
    this.elements.articleSubmit.disabled = true;

    try {
      // Fetching single article for edit - this should work fine
      const article = await ApiService.getArticle(articleId);
      if (!article) throw new Error("Article not found by API");

      // Populate common fields
      this.elements.articleId.value = article.id;
      this.elements.articleCategory.value = article.category;
      this.elements.articleAuthor.value = article.author;
      this.elements.articleImage.value = article.imageUrl || "";

      // Populate language-specific fields
      ["en", "rus", "mng"].forEach((lang) => {
        const titleInput = this.elements[`articleTitle_${lang}`];
        const excerptInput = this.elements[`articleExcerpt_${lang}`];
        const hiddenContentInput = this.elements[`articleContent_${lang}`];
        const quillInstance = this.quillInstances[lang];

        // NOTE: When editing, fetch ALL fields from backend, not just aliased ones
        // The /api/articles/:id endpoint might need adjustment if it's currently
        // ONLY returning aliased fields based on 'lang' query param.
        // For admin edit, we likely need title_en, title_rus, title_mng, etc.
        // Let's assume getArticle fetches all fields needed for edit for now.
        if (titleInput) titleInput.value = article[`title_${lang}`] || "";
        if (excerptInput) excerptInput.value = article[`excerpt_${lang}`] || "";
        const contentToLoad = article[`content_${lang}`] || "";
        if (quillInstance) quillInstance.root.innerHTML = contentToLoad;
        if (hiddenContentInput) hiddenContentInput.value = contentToLoad;
      });

      // Update form state
      this.elements.articleSubmit.textContent = "Update Article";
      if (this.elements.formHeading)
        this.elements.formHeading.textContent = "Edit Article";
      this.displayMessage(this.elements.articleFormMessage, "", false);
      this.elements.articleFormContainer.classList.remove("hidden");
      this.elements.articleForm.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (err) {
      console.error("Error loading article for editing:", err);
      this.displayMessage(
        this.elements.articleFormMessage,
        `Error loading article: ${err.message}`,
        true,
      );
    } finally {
      this.elements.articleSubmit.disabled = false;
    }
  },

  resetForm() {
    if (!this.elements.articleForm) return;
    this.elements.articleForm.reset();
    ["en", "rus", "mng"].forEach((lang) => {
      const quillInstance = this.quillInstances[lang];
      const hiddenContentInput = this.elements[`articleContent_${lang}`];
      if (quillInstance) quillInstance.root.innerHTML = "";
      if (hiddenContentInput) hiddenContentInput.value = "";
    });
    this.elements.articleId.value = "";
    this.elements.articleSubmit.textContent = "Create Article";
    if (this.elements.formHeading)
      this.elements.formHeading.textContent = "Create Article";
    if (this.elements.articleFormMessage) {
      this.elements.articleFormMessage.textContent = "";
      this.elements.articleFormMessage.className = "mt-4 text-center text-sm";
    }
  },

  displayMessage(messageElement, message, isError = false) {
    if (!messageElement) {
      console.warn(
        "Attempted to display message, but message element is missing.",
      );
      return;
    }
    messageElement.textContent = message;
    messageElement.className = `mt-4 text-center text-sm ${isError ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
  },

  // --- Event Handlers ---

  async handleLogin(e) {
    e.preventDefault();
    if (!this.elements.loginForm) return;
    const usernameInput = this.elements.loginForm.querySelector("#username");
    const passwordInput = this.elements.loginForm.querySelector("#password");
    const username = usernameInput?.value.trim();
    const password = passwordInput?.value;

    if (!username || !password) {
      this.displayMessage(
        this.elements.loginMessage,
        "Username and password are required.",
        true,
      );
      return;
    }
    this.displayMessage(this.elements.loginMessage, "Logging in...", false);
    const submitButton = this.elements.loginForm.querySelector(
      'button[type="submit"]',
    );
    if (submitButton) submitButton.disabled = true;

    try {
      const data = await ApiService.login(username, password);
      AuthService.setTokens(data.accessToken, data.refreshToken);
      this.displayMessage(
        this.elements.loginMessage,
        "Login successful!",
        false,
      );
      this.updateUI();
    } catch (err) {
      console.error("Login Error (in handleLogin):", err);
      this.displayMessage(
        this.elements.loginMessage,
        `Login failed: ${err.message}`,
        true,
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  },

  async handleArticleSubmit(e) {
    e.preventDefault();
    if (!this.elements.articleForm) return;

    ["en", "rus", "mng"].forEach((lang) => {
      // Sync Quill content
      const quillInstance = this.quillInstances[lang];
      const hiddenContentInput = this.elements[`articleContent_${lang}`];
      if (quillInstance && hiddenContentInput) {
        hiddenContentInput.value = quillInstance.root.innerHTML;
      } else if (!hiddenContentInput) {
        console.error(`Hidden content input not found for ${lang}!`);
      }
    });

    const articleId = this.elements.articleId.value;
    const articleData = {
      title_en: this.elements.articleTitle_en.value.trim(),
      content_en: this.elements.articleContent_en.value,
      excerpt_en: this.elements.articleExcerpt_en.value.trim() || null,
      title_rus: this.elements.articleTitle_rus.value.trim() || null,
      content_rus: this.elements.articleContent_rus.value || null,
      excerpt_rus: this.elements.articleExcerpt_rus.value.trim() || null,
      title_mng: this.elements.articleTitle_mng.value.trim() || null,
      content_mng: this.elements.articleContent_mng.value || null,
      excerpt_mng: this.elements.articleExcerpt_mng.value.trim() || null,
      category: this.elements.articleCategory.value,
      author: this.elements.articleAuthor.value.trim(),
      imageUrl: this.elements.articleImage.value.trim() || null,
    };

    // Basic client validation
    if (
      !articleData.title_en ||
      !articleData.content_en ||
      !articleData.category ||
      !articleData.author
    ) {
      this.displayMessage(
        this.elements.articleFormMessage,
        "English Title, English Content, Category, and Author are required.",
        true,
      );
      return;
    }

    const action = articleId ? "Updating" : "Creating";
    console.log(
      `${action} article ${articleId ? `(ID: ${articleId})` : ""}...`,
    );
    this.displayMessage(
      this.elements.articleFormMessage,
      `${action} article...`,
      false,
    );
    if (this.elements.articleSubmit)
      this.elements.articleSubmit.disabled = true;

    try {
      let result;
      if (articleId) {
        result = await ApiService.updateArticle(articleId, articleData);
        this.displayMessage(
          this.elements.articleFormMessage,
          "Article updated successfully!",
          false,
        );
      } else {
        result = await ApiService.createArticle(articleData);
        this.displayMessage(
          this.elements.articleFormMessage,
          "Article created successfully!",
          false,
        );
      }
      console.log(`Article ${action} successful:`, result?.id);

      this.resetForm();
      this.elements.articleFormContainer?.classList.add("hidden");
      await this.loadArticles(); // Refresh list

      setTimeout(() => {
        // Clear success message
        if (
          this.elements.articleFormMessage?.textContent.includes("successfully")
        ) {
          this.displayMessage(this.elements.articleFormMessage, "", false);
        }
      }, 3000);
    } catch (err) {
      console.error(`Article ${action} Error:`, err);
      let errorMessage = `Error: ${err.message}`;
      if (err.errors && Array.isArray(err.errors)) {
        // Display validation errors
        errorMessage = `Error: ${err.errors.map((e) => `${e.field || "Input"}: ${e.msg || e.message}`).join(", ")}`;
      }
      this.displayMessage(this.elements.articleFormMessage, errorMessage, true);
    } finally {
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.disabled = false;
    }
  },

  async handleDeleteArticle(articleId) {
    if (!articleId) {
      console.error("Delete requested without article ID.");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to delete article ID ${articleId}? This cannot be undone.`,
      )
    ) {
      return;
    }

    console.log(`Attempting to delete article ${articleId}...`);
    try {
      await ApiService.deleteArticle(articleId);
      console.log(`Article ${articleId} deleted successfully.`);
      alert(`Article ${articleId} deleted successfully.`);
      this.loadArticles(); // Refresh list
    } catch (err) {
      console.error("Error deleting article:", err);
      alert(`Failed to delete article: ${err.message}`);
    }
  },

  handleNewArticleClick() {
    if (!this.elements.articleFormContainer) return;
    this.resetForm();
    this.elements.articleFormContainer.classList.remove("hidden");
    this.elements.articleForm?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  },

  handleCancelClick() {
    if (!this.elements.articleFormContainer) return;
    this.resetForm();
    this.elements.articleFormContainer.classList.add("hidden");
  },

  handleLogout() {
    console.log("Logout initiated.");
    AuthService.clearTokens();
    this.updateUI();
  },
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  AdminUI.initialize();
});
