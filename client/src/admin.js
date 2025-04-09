// client/src/admin.js
import "./style.css";

// --- API Service ---
const ApiService = {
  baseUrl: "https://localhost:3000/api", // Should match Vite proxy target base
  csrfToken: null,

  async fetchCsrfToken() {
    try {
      // Use relative path because of Vite proxy
      const response = await fetch(`/api/csrf-token`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            `Failed fetch CSRF: ${response.status} Too Many Requests.`,
          );
        }
        throw new Error(
          `Failed fetch CSRF: ${response.status} ${response.statusText}`,
        );
      }
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      console.log("CSRF Token fetched.");
      return this.csrfToken;
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      throw error; // Re-throw to be caught by caller
    }
  },

  async makeRequest(url, method = "GET", data = null, isRetry = false) {
    // url = Full backend URL like https://localhost:3000/api/admin/login
    // We need the path part that the Vite proxy understands, starting with /api

    let fetchPath;
    try {
      // Check if the provided URL is one of our backend API URLs
      if (url.startsWith(this.baseUrl)) {
        // Extract the pathname part (e.g., /api/admin/login)
        const urlObject = new URL(url);
        fetchPath = urlObject.pathname;
      } else if (url.startsWith("/api/")) {
        // If it's already a relative path starting with /api/
        fetchPath = url;
      } else {
        // If it's some other URL or unexpected format, use it as is (might fail)
        console.warn("makeRequest called with non-API base URL:", url);
        fetchPath = url;
      }
    } catch (e) {
      console.error("Error parsing URL in makeRequest:", url, e);
      // Fallback if URL parsing fails for some reason
      fetchPath = url.startsWith(this.baseUrl)
        ? url.substring(this.baseUrl.indexOf("/api"))
        : url;
    }

    // Ensure CSRF token is fetched for modifying requests
    if (
      !this.csrfToken &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase()) &&
      !isRetry
    ) {
      try {
        console.log("Attempting pre-fetch CSRF token...");
        await this.fetchCsrfToken();
      } catch (csrfError) {
        console.error("Failed pre-fetch CSRF token:", csrfError);
        // Allow the request to proceed; retry logic might handle it
      }
    }

    const headers = { "Content-Type": "application/json" };
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

    const options = {
      method: method.toUpperCase(),
      headers,
      credentials: "include",
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      // Use the calculated fetchPath, which should start with /api/ for backend requests
      console.log(`Making API request: ${method} ${fetchPath}`);
      const response = await fetch(fetchPath, options); // Fetch relative to Vite origin

      // --- CSRF Retry Logic ---
      if (response.status === 403 && !isRetry) {
        try {
          const errorJson = await response.clone().json();
          if (
            errorJson.message &&
            errorJson.message.toLowerCase().includes("invalid csrf token")
          ) {
            console.warn(
              "CSRF token invalid, fetching new token and retrying ONCE...",
            );
            this.csrfToken = null;
            await this.fetchCsrfToken();
            // Retry the original request (pass original full URL to restart logic)
            return this.makeRequest(url, method, data, true);
          }
        } catch (e) {
          console.error("Could not parse potential CSRF error response:", e);
        }
      }
      // --- End CSRF Retry Logic ---

      if (response.status === 204) {
        return null;
      }

      if (!response.ok) {
        let errorData = {
          message: `Request failed: ${response.status} ${response.statusText}`,
          statusCode: response.status,
        };
        let responseText = "";
        try {
          responseText = await response.text();
          errorData = JSON.parse(responseText);
          if (!errorData.statusCode) errorData.statusCode = response.status;
        } catch (e) {
          errorData.responseText = responseText;
          console.warn(
            `Failed to parse error response JSON for ${method} ${fetchPath}. Raw: ${responseText.substring(0, 150)}...`,
          );
        }
        const error = new Error(
          errorData.message || `Request failed with status ${response.status}`,
        );
        error.statusCode = errorData.statusCode;
        error.data = errorData;
        console.error(
          `API Request Failed: ${error.statusCode} - ${error.message}`,
          error.data,
        );
        throw error;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        const text = await response.text();
        console.log(
          `Received non-JSON OK response for ${method} ${fetchPath}:`,
          text.substring(0, 100) + "...",
        );
        return text;
      }
    } catch (networkOrProcessingError) {
      console.error(
        `API Error during ${method} ${fetchPath}:`,
        networkOrProcessingError,
      );
      const errorToThrow = new Error(
        networkOrProcessingError.message ||
          `Network or processing error occurred.`,
      );
      errorToThrow.statusCode = networkOrProcessingError.statusCode || 500;
      errorToThrow.data = networkOrProcessingError.data || {};
      throw errorToThrow;
    }
  },

  // --- Authentication ---
  async login(username, password) {
    // Uses makeRequest internally, which uses relative path /api/admin/login
    return this.makeRequest(`${this.baseUrl}/admin/login`, "POST", {
      username,
      password,
    });
  },

  async refreshToken() {
    const currentRefreshToken = localStorage.getItem("refreshToken");
    if (!currentRefreshToken) {
      console.log("No refresh token found in localStorage.");
      return null; // No token to refresh
    }
    try {
      // Uses makeRequest internally, which uses relative path /api/admin/refresh
      const data = await this.makeRequest(
        `${this.baseUrl}/admin/refresh`,
        "POST",
        { refreshToken: currentRefreshToken },
      );
      console.log("Refresh token successful.");
      return data.accessToken; // Return the new access token
    } catch (error) {
      console.error("Refresh token failed:", error);
      AuthService.clearTokens(); // Clear tokens on refresh failure
      // Optionally, redirect to login or show message
      // window.location.href = '/admin.html';
      throw error; // Re-throw error for handling by makeAuthenticatedRequest
    }
  },

  async makeAuthenticatedRequest(url, method = "GET", data = null) {
    try {
      // First attempt with current access token
      return await this.makeRequest(url, method, data);
    } catch (error) {
      // Check if the error is likely due to expired/invalid access token (401 or 403)
      const statusCode = error.statusCode;
      if (statusCode === 401 || statusCode === 403) {
        console.warn(
          `Auth error (${statusCode}) on ${method} ${url}. Attempting token refresh...`,
        );
        try {
          // Attempt to get a new access token using the refresh token
          const newAccessToken = await this.refreshToken();
          if (newAccessToken) {
            localStorage.setItem("accessToken", newAccessToken); // Store the new token
            console.log(`Retrying ${method} ${url} with new access token.`);
            // Retry the original request ONCE with the new token
            // Pass the original full URL to makeRequest for the retry
            return await this.makeRequest(url, method, data);
          } else {
            // Refresh failed (e.g., refresh token expired or invalid)
            console.error(
              "Token refresh failed or no refresh token available. Redirecting to login.",
            );
            AuthService.clearTokens(); // Ensure tokens are cleared
            window.location.href = "/admin.html"; // Redirect to login
            // Throw a more specific error for the UI?
            throw new Error("Session expired. Please log in again.");
          }
        } catch (refreshError) {
          // Catch errors during the refresh attempt itself
          console.error("Error during token refresh attempt:", refreshError);
          // Already handled token clearing and potential redirect in refreshToken failure
          // Throw error to prevent further execution
          throw new Error(
            "Session expired or refresh failed. Please log in again.",
          );
        }
      } else {
        // If the error was not 401/403, re-throw it
        console.error(`Non-authentication error on ${method} ${url}:`, error);
        throw error;
      }
    }
  },

  async getMe() {
    return this.makeAuthenticatedRequest(`${this.baseUrl}/admin/me`);
  },

  // --- Articles ---
  async getArticles() {
    // Public endpoint, but use authenticated request if needed later for drafts etc.
    // Using public /api/articles/all endpoint
    return this.makeAuthenticatedRequest(`${this.baseUrl}/articles/all`);
  },

  async getArticle(id) {
    // Uses authenticated request to potentially fetch unpublished articles if needed by admin
    return this.makeAuthenticatedRequest(`${this.baseUrl}/articles/${id}`);
  },

  async createArticle(articleData) {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles`,
      "POST",
      articleData,
    );
  },

  async updateArticle(id, articleData) {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles/${id}`,
      "PUT",
      articleData,
    );
  },

  async deleteArticle(id) {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles/${id}`,
      "DELETE",
    );
  },

  // --- Users (Admin) ---
  async getUsers(filters = {}) {
    let queryString = "";
    if (filters.role) {
      queryString = `?role=${encodeURIComponent(filters.role)}`;
    }
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/users${queryString}`,
    );
  },

  async createUser(userData) {
    // For creating moderators
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/users`,
      "POST",
      userData,
    );
  },

  // --- Suggestions ---
  async suggestArticleEdit(articleId, articleData) {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles/${articleId}/suggest`,
      "POST",
      articleData,
    );
  },

  async suggestNewArticle(articleData) {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles/suggest-new`,
      "POST",
      articleData,
    );
  },

  async getSuggestions(status = "pending") {
    // Admin view of all suggestions
    const queryString = `?status=${encodeURIComponent(status)}`;
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions${queryString}`,
    );
  },

  async getSuggestionDetails(suggestionId) {
    // Admin view of specific suggestion detail
    if (!suggestionId) throw new Error("Suggestion ID is required.");
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}`,
    );
  },

  async approveSuggestion(suggestionId) {
    // Admin action
    if (!suggestionId) throw new Error("Suggestion ID is required.");
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}/approve`,
      "POST",
    );
  },

  async rejectSuggestion(suggestionId, adminComments = null) {
    // Admin action
    if (!suggestionId) throw new Error("Suggestion ID is required.");
    const body = adminComments ? { adminComments } : {}; // Send empty object if no comments
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}/reject`,
      "POST",
      body,
    );
  },

  // +++ Method for moderators to get their own suggestions +++
  async getMySuggestions() {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/my`,
    );
  },
  // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
}; // End of ApiService object

// --- Auth Service ---
const AuthService = {
  isLoggedIn() {
    return (
      localStorage.getItem("accessToken") !== null &&
      localStorage.getItem("refreshToken") !== null
    );
  },
  setTokens(accessToken, refreshToken) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  },
  clearTokens() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    ApiService.csrfToken = null; // Also clear the CSRF token from memory
    console.log("Access and Refresh Tokens cleared from localStorage.");
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
    // Article form fields
    articleTitle_en: document.getElementById("article-title-en"),
    editorContainer_en: document.getElementById("editor-container-en"),
    articleContent_en: document.getElementById("article-content-en"), // Hidden input
    articleExcerpt_en: document.getElementById("article-excerpt-en"),
    articleTitle_rus: document.getElementById("article-title-rus"),
    editorContainer_rus: document.getElementById("editor-container-rus"),
    articleContent_rus: document.getElementById("article-content-rus"), // Hidden input
    articleExcerpt_rus: document.getElementById("article-excerpt-rus"),
    articleTitle_mng: document.getElementById("article-title-mng"),
    editorContainer_mng: document.getElementById("editor-container-mng"),
    articleContent_mng: document.getElementById("article-content-mng"), // Hidden input
    articleExcerpt_mng: document.getElementById("article-excerpt-mng"),
    articleId: document.getElementById("article-id"), // Hidden input for ID
    articleCategory: document.getElementById("article-category"),
    articleAuthor: document.getElementById("article-author"),
    articleImage: document.getElementById("article-image"),
    articleSubmit: document.getElementById("article-submit"),
    // Messages
    articleFormMessage: document.getElementById("article-form-message"),
    loginMessage: document.getElementById("login-message"),
    createModeratorMessage: document.getElementById("create-moderator-message"),
    // Containers
    articlesContainer: document.getElementById("articles-container"),
    // Admin specific sections/buttons
    manageModeratorsButtonWrapper: document.getElementById(
      "manage-moderators-button-wrapper",
    ),
    manageModeratorsButton: document.getElementById("manage-moderators-button"),
    moderatorsSection: document.getElementById("moderators-section"), // Contains admin lists/forms
    moderatorsListContainer: document.getElementById(
      "moderators-list-container",
    ),
    createModeratorForm: document.getElementById("create-moderator-form"),
    suggestionsListContainer: document.getElementById(
      "suggestions-list-container",
    ), // Admin list
    // +++ Add new element ID for moderator's view +++
    moderatorSuggestionsSection: document.getElementById(
      "moderator-suggestions-section",
    ),
    // ++++++++++++++++++++++++++++++++++++++++++++++++
    // Modal elements (for admin viewing details)
    suggestionModal: document.getElementById("suggestion-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalCloseButton: document.getElementById("modal-close-button"),
  },
  currentUserRole: null, // Store the user's role ('admin' or 'moderator')
  quillInstances: { en: null, rus: null, mng: null }, // Store Quill editor instances

  initialize() {
    // Ensure Quill is loaded before initializing editors
    if (typeof Quill === "undefined") {
      console.error("Quill.js not loaded. Cannot initialize editor.");
      this.displayMessage(
        this.elements.articleFormMessage,
        "Text editor failed to load. Please refresh.",
        true,
      );
    } else {
      this.initQuillEditor();
    }
    this.setupEventListeners();
    this.updateUI(); // Initial UI setup based on login state
  },

  initQuillEditor() {
    // Standard Quill toolbar options
    const toolbarOptions = [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }], // Color options
      ["link", "image"], // Link and image insertion
      ["clean"], // Remove formatting button
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

          this.quillInstances[lang].on(
            "text-change",
            (delta, oldDelta, source) => {
              if (source === "user" && this.quillInstances[lang]) {
                hiddenInput.value = this.quillInstances[lang].root.innerHTML;
              }
            },
          );
        } catch (error) {
          console.error(`Failed to initialize Quill for ${lang}:`, error);
          this.displayMessage(
            this.elements.articleFormMessage,
            `Failed to load ${lang.toUpperCase()} text editor.`,
            true,
          );
        }
      } else {
        console.warn(
          `Quill container or hidden input elements not found for language: ${lang}`,
        );
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
    this.elements.createModeratorForm?.addEventListener(
      "submit",
      this.handleCreateModeratorSubmit.bind(this),
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
    this.elements.manageModeratorsButton?.addEventListener(
      "click",
      this.handleManageModeratorsClick.bind(this),
    );

    this.elements.articlesContainer?.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const articleId = button.dataset.id;
      if (!articleId) return;
      if (button.classList.contains("edit-article"))
        this.loadArticleForEditing(articleId);
      else if (button.classList.contains("delete-article"))
        this.handleDeleteArticle(articleId);
      else if (button.classList.contains("suggest-edit-article"))
        this.handleSuggestEditClick(articleId);
    });

    this.elements.suggestionsListContainer?.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        const suggestionId = button.dataset.suggestionId;
        if (!suggestionId) return;
        if (button.classList.contains("approve-suggestion"))
          this.handleApproveSuggestion(suggestionId, button);
        else if (button.classList.contains("reject-suggestion"))
          this.handleRejectSuggestion(suggestionId, button);
        else if (button.classList.contains("view-suggestion"))
          this.showSuggestionDetails(suggestionId);
      },
    );

    this.elements.modalCloseButton?.addEventListener("click", () =>
      this.closeSuggestionModal(),
    );
    this.elements.suggestionModal?.addEventListener("click", (event) => {
      if (event.target === this.elements.suggestionModal)
        this.closeSuggestionModal();
    });
  },

  handleManageModeratorsClick() {
    console.log("[AdminUI] Manage Moderators button clicked.");
    if (this.currentUserRole !== "admin") return;
    const section = this.elements.moderatorsSection;
    if (!section) return;
    section.classList.toggle("hidden");
    if (!section.classList.contains("hidden")) {
      console.log("[AdminUI] Moderators section visible, loading data...");
      this.loadModerators();
      this.loadSuggestions();
    } else {
      console.log("[AdminUI] Moderators section hidden.");
    }
  },

  async updateUI() {
    const loggedIn = AuthService.isLoggedIn();
    this.currentUserRole = null;

    if (loggedIn) {
      this.elements.loginPanel?.classList.add("hidden");
      this.elements.adminPanel?.classList.remove("hidden");
      try {
        const userInfo = await ApiService.getMe();
        this.currentUserRole = userInfo?.role;
        if (
          !this.currentUserRole ||
          !["admin", "moderator"].includes(this.currentUserRole)
        ) {
          console.error("[Admin UI] Invalid or missing user role:", userInfo);
          AuthService.clearTokens();
          window.location.reload();
          return;
        }
        console.log("[Admin UI] User Role:", this.currentUserRole);
        this.renderUIForRole();
        this.loadArticles();
        if (this.currentUserRole === "moderator") {
          this.loadMySuggestions(); // Load suggestions for moderators
        }
      } catch (error) {
        console.error("[Admin UI] Error updating UI:", error);
        AuthService.clearTokens();
        this.elements.loginPanel?.classList.remove("hidden");
        this.elements.adminPanel?.classList.add("hidden");
        this.clearAdminContent();
        this.displayMessage(
          this.elements.loginMessage,
          "Session error. Please log in again.",
          true,
        );
      }
    } else {
      this.elements.loginPanel?.classList.remove("hidden");
      this.elements.adminPanel?.classList.add("hidden");
      this.clearAdminContent();
    }
  },

  renderUIForRole() {
    this.elements.manageModeratorsButtonWrapper?.classList.add("hidden");
    this.elements.moderatorsSection?.classList.add("hidden");
    this.elements.moderatorSuggestionsSection?.classList.add("hidden"); // Hide by default
    this.elements.newArticleButton?.classList.add("hidden");

    if (this.currentUserRole === "admin") {
      console.log("[Admin UI] Rendering for ADMIN");
      this.elements.manageModeratorsButtonWrapper?.classList.remove("hidden");
      if (this.elements.newArticleButton) {
        this.elements.newArticleButton.textContent = "Create New Article";
        this.elements.newArticleButton.classList.remove("hidden");
      }
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.textContent = this.elements.articleId.value
          ? "Update Article"
          : "Create Article";
      if (this.elements.formHeading)
        this.elements.formHeading.textContent = this.elements.articleId.value
          ? "Edit Article"
          : "Create New Article";
    } else if (this.currentUserRole === "moderator") {
      console.log("[Admin UI] Rendering for MODERATOR");
      this.elements.moderatorSuggestionsSection?.classList.remove("hidden"); // Show moderator section
      if (this.elements.newArticleButton) {
        this.elements.newArticleButton.textContent = "Suggest New Article";
        this.elements.newArticleButton.classList.remove("hidden");
      }
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.textContent = "Submit Suggestion";
      if (this.elements.formHeading)
        this.elements.formHeading.textContent = this.elements.articleId.value
          ? "Suggest Edits For Article"
          : "Suggest New Article";
    } else {
      console.log("[Admin UI] Rendering for UNKNOWN role");
    }
  },

  clearAdminContent() {
    if (this.elements.articlesContainer)
      this.elements.articlesContainer.innerHTML = "";
    if (this.elements.articleFormContainer)
      this.elements.articleFormContainer.classList.add("hidden");
    if (this.elements.moderatorsSection)
      this.elements.moderatorsSection.classList.add("hidden");
    if (this.elements.moderatorsListContainer)
      this.elements.moderatorsListContainer.innerHTML = "";
    if (this.elements.suggestionsListContainer)
      this.elements.suggestionsListContainer.innerHTML = "";
    if (this.elements.moderatorSuggestionsSection)
      this.elements.moderatorSuggestionsSection.innerHTML = ""; // Clear moderator view
    this.closeSuggestionModal();
    this.resetForm();
  },

  async loadArticles() {
    if (!this.elements.articlesContainer) return;
    this.elements.articlesContainer.innerHTML =
      '<p class="text-center p-4 col-span-full">Loading articles...</p>';
    try {
      const articlesArray = await ApiService.getArticles();
      if (!Array.isArray(articlesArray))
        throw new Error("Invalid articles list format.");
      console.log("[Admin] Received articles:", articlesArray);
      this.renderArticles(articlesArray);
    } catch (err) {
      console.error("[Admin] Error loading articles:", err);
      this.elements.articlesContainer.innerHTML = `<p class="text-red-500 text-center p-4 col-span-full">Failed to load articles: ${err.message}</p>`;
    }
  },

  renderArticles(articles) {
    if (!this.elements.articlesContainer) return;
    if (!Array.isArray(articles)) {
      console.error("[Admin] renderArticles received non-array:", articles);
      this.elements.articlesContainer.innerHTML =
        "<p class='text-red-500 text-center p-4 col-span-full'>Error: Invalid article data.</p>";
      return;
    }
    if (articles.length === 0) {
      this.elements.articlesContainer.innerHTML =
        "<p class='text-center p-4 col-span-full'>No articles found.</p>";
      return;
    }
    this.elements.articlesContainer.innerHTML = articles
      .map((article) => {
        if (!article || typeof article !== "object" || !article.id) {
          console.warn("[Admin] Skipping invalid article object:", article);
          return "";
        }
        const title = article.title_en || article.title || "Untitled Article";
        const category = article.category || "?";
        const author = article.author || "?";
        const imageUrl = article.imageUrl;
        const status = article.status || "?";
        let buttonsHTML = "";
        if (this.currentUserRole === "admin") {
          buttonsHTML = `<button class="edit-article btn btn-blue text-sm py-1 px-3" data-id="${article.id}">Edit</button> <button class="delete-article btn btn-red text-sm py-1 px-3" data-id="${article.id}">Delete</button>`;
        } else if (this.currentUserRole === "moderator") {
          buttonsHTML = `<button class="suggest-edit-article btn btn-blue text-sm py-1 px-3" data-id="${article.id}">Suggest Edit</button>`;
        }
        return `<div class="article-card border dark:border-gray-600 rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-700 flex flex-col"> ${imageUrl ? `<img src="${imageUrl}" alt="${title}" class="w-full h-48 object-cover">` : '<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300">No Image</div>'} <div class="p-4 flex flex-col flex-grow"> <h3 class="text-lg font-bold mb-1 dark:text-white flex-grow">${title}</h3> <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Cat: ${category}</p> <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">By: ${author}</p> <p class="text-sm font-medium ${status === "published" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"} mb-2 capitalize">Status: ${status}</p> <div class="mt-auto pt-2 flex space-x-2">${buttonsHTML}</div> </div> </div>`;
      })
      .join("");
    // Listeners handled by delegation
  },

  async loadModerators() {
    if (
      this.currentUserRole !== "admin" ||
      !this.elements.moderatorsListContainer
    )
      return;
    console.log("[Admin] Loading moderators...");
    this.elements.moderatorsListContainer.innerHTML =
      '<p class="text-center p-4">Loading...</p>';
    try {
      const moderators = await ApiService.getUsers({ role: "moderator" });
      this.renderModerators(moderators);
    } catch (error) {
      console.error("[Admin] Error loading moderators:", error);
      this.elements.moderatorsListContainer.innerHTML = `<p class="text-red-500 text-center p-4">Failed: ${error.message}</p>`;
    }
  },

  renderModerators(moderators) {
    if (
      this.currentUserRole !== "admin" ||
      !this.elements.moderatorsListContainer
    )
      return;
    if (!Array.isArray(moderators)) {
      this.elements.moderatorsListContainer.innerHTML =
        '<p class="text-red-500 text-center p-4">Error: Invalid data.</p>';
      return;
    }
    if (moderators.length === 0) {
      this.elements.moderatorsListContainer.innerHTML =
        '<p class="text-center p-4">No moderators found.</p>';
      return;
    }
    this.elements.moderatorsListContainer.innerHTML = `<ul class="space-y-2"> ${moderators.map((mod) => `<li class="flex justify-between items-center p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-800"> <span>${mod.username} (<span class="text-xs text-gray-500 dark:text-gray-400">${mod.email}</span>) ${mod.needsPasswordChange ? '<span class="text-xs text-orange-500 ml-2 font-semibold">(Needs PW Reset)</span>' : ""}</span> </li>`).join("")} </ul>`;
  },

  async loadSuggestions() {
    // Admin loads pending suggestions
    if (
      this.currentUserRole !== "admin" ||
      !this.elements.suggestionsListContainer
    )
      return;
    console.log("[Admin] Loading pending suggestions...");
    this.elements.suggestionsListContainer.innerHTML =
      '<p class="text-center p-4">Loading suggestions...</p>';
    try {
      const suggestions = await ApiService.getSuggestions("pending");
      console.log("[Admin] Received pending suggestions data:", suggestions);
      this.renderSuggestions(suggestions);
    } catch (error) {
      console.error("[Admin] Error loading suggestions:", error);
      this.elements.suggestionsListContainer.innerHTML = `<p class="text-red-500 text-center p-4">Failed: ${error.message}</p>`;
    }
  },

  renderSuggestions(suggestions) {
    // Admin renders list of pending suggestions
    if (
      this.currentUserRole !== "admin" ||
      !this.elements.suggestionsListContainer
    )
      return;
    console.log("[Admin] renderSuggestions called with:", suggestions);
    if (!Array.isArray(suggestions)) {
      console.error("[Admin] Invalid suggestion data received.");
      this.elements.suggestionsListContainer.innerHTML =
        '<p class="text-red-500 text-center p-4">Error: Invalid data.</p>';
      return;
    }
    if (suggestions.length === 0) {
      this.elements.suggestionsListContainer.innerHTML =
        '<p class="text-center p-4 text-gray-500 dark:text-gray-400">No pending suggestions.</p>';
      return;
    }
    console.log(`[Admin] Rendering ${suggestions.length} suggestions.`);
    this.elements.suggestionsListContainer.innerHTML = suggestions
      .map((suggestion) => {
        let articleTitle;
        const isNew = !suggestion.articleId; // Use !articleId to check if it's a new proposal
        if (!isNew && suggestion.article) {
          articleTitle =
            suggestion.article.title_en ||
            `Article ID: ${suggestion.articleId}`;
        } else if (isNew) {
          // Use proposedTitle field added by backend processing
          articleTitle = suggestion.proposedTitle || "(New Article Proposal)";
          articleTitle +=
            ' <span class="text-xs font-normal text-blue-500 dark:text-blue-400">(New)</span>';
        } else {
          articleTitle = `Article ID: ${suggestion.articleId || "(Unknown)"}`;
          if (isNew)
            articleTitle +=
              ' <span class="text-xs font-normal text-blue-500 dark:text-blue-400">(New)</span>';
        }
        const moderatorName =
          suggestion.moderator?.username ||
          `User ID: ${suggestion.moderatorId}`;
        const suggestionDate = suggestion.createdAt
          ? new Date(suggestion.createdAt).toLocaleDateString()
          : "?";
        return `<div class="suggestion-item p-3 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 shadow-sm"> <div class="flex flex-wrap justify-between items-center gap-2 mb-2"> <div> <span class="block font-semibold dark:text-white">Article: ${articleTitle}</span> <span class="block text-sm text-gray-600 dark:text-gray-400">By: ${moderatorName} on ${suggestionDate}</span> </div> <div class="flex justify-end items-center gap-2 mt-2 sm:mt-0 suggestion-actions flex-shrink-0"> <span class="text-sm text-green-600 dark:text-green-400 hidden success-message">Approved!</span> <span class="text-sm text-red-600 dark:text-red-400 hidden reject-message">Rejected!</span> <span class="text-sm text-red-600 dark:text-red-400 hidden error-message"></span> <button class="view-suggestion btn btn-gray text-xs py-1 px-2" data-suggestion-id="${suggestion.id}">Details</button> <button class="reject-suggestion btn btn-red text-xs py-1 px-2" data-suggestion-id="${suggestion.id}">Reject</button> <button class="approve-suggestion btn btn-green text-xs py-1 px-2" data-suggestion-id="${suggestion.id}">Approve</button> </div> </div> </div>`;
      })
      .join("");
    // Listeners handled by delegation
  },

  async showSuggestionDetails(suggestionId) {
    // Admin views details in modal
    if (!this.elements.suggestionModal || !this.elements.modalBody) return;
    console.log(`[Admin] Showing details for suggestion ${suggestionId}`);
    this.elements.modalBody.innerHTML =
      '<p class="p-4 text-center">Loading details...</p>';
    this.elements.suggestionModal.classList.remove("hidden");
    this.elements.suggestionModal.classList.add("flex");
    try {
      const suggestion = await ApiService.getSuggestionDetails(suggestionId);
      if (!suggestion || !suggestion.proposedData)
        throw new Error("Suggestion data missing.");
      const proposed = suggestion.proposedData;
      const isNew = !suggestion.articleId;
      const articleTitle = isNew
        ? proposed.title_en || "(New Article)"
        : suggestion.article?.title_en || `Article ID: ${suggestion.articleId}`;
      const moderatorName =
        suggestion.moderator?.username || `User ID: ${suggestion.moderatorId}`;
      if (this.elements.modalTitle)
        this.elements.modalTitle.textContent = `Suggestion for: ${articleTitle} ${isNew ? "(New)" : ""}`;
      this.elements.modalBody.innerHTML = `<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Submitted by: ${moderatorName}</p> <div class="space-y-4"> <h4 class="font-bold text-lg border-b dark:border-gray-600 pb-1 mb-2">Proposed Changes:</h4> ${this.renderProposedField("Title (EN)", proposed.title_en)} ${this.renderProposedField("Content (EN)", proposed.content_en, true)} ${this.renderProposedField("Excerpt (EN)", proposed.excerpt_en)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Title (RU)", proposed.title_rus)} ${this.renderProposedField("Content (RU)", proposed.content_rus, true)} ${this.renderProposedField("Excerpt (RU)", proposed.excerpt_rus)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Title (MN)", proposed.title_mng)} ${this.renderProposedField("Content (MN)", proposed.content_mng, true)} ${this.renderProposedField("Excerpt (MN)", proposed.excerpt_mng)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Category", proposed.category)} ${this.renderProposedField("Author", proposed.author)} ${this.renderProposedField("Image URL", proposed.imageUrl)} </div>`;
    } catch (error) {
      console.error(
        `Error fetching suggestion details ${suggestionId}:`,
        error,
      );
      this.elements.modalBody.innerHTML = `<p class="p-4 text-center text-red-500">Error: ${error.message}</p>`;
    }
  },

  renderProposedField(label, value, isHtml = false) {
    const displayValue = value
      ? value
      : '<span class="text-gray-400 italic">(no change or empty)</span>';
    return `<div class="mb-2"> <strong class="block text-sm font-medium text-gray-700 dark:text-gray-300">${label}:</strong> ${isHtml ? `<div class="mt-1 text-sm text-gray-900 dark:text-gray-100 prose prose-sm dark:prose-invert max-w-none border dark:border-gray-600 p-2 rounded">${displayValue}</div>` : `<span class="mt-1 text-sm text-gray-900 dark:text-gray-100">${displayValue}</span>`} </div>`;
  },

  closeSuggestionModal() {
    if (!this.elements.suggestionModal) return;
    this.elements.suggestionModal.classList.add("hidden");
    this.elements.suggestionModal.classList.remove("flex");
    if (this.elements.modalBody) this.elements.modalBody.innerHTML = "";
    if (this.elements.modalTitle)
      this.elements.modalTitle.textContent = "Suggestion Details";
  },

  // +++ Moderator: Own Suggestions View +++
  async loadMySuggestions() {
    const container = this.elements.moderatorSuggestionsSection;
    if (!container) {
      console.warn("[Moderator] Suggestions section element not found.");
      return;
    }
    container.innerHTML =
      '<p class="text-center p-4">Loading your suggestions...</p>';
    try {
      const suggestions = await ApiService.getMySuggestions();
      console.log("[Moderator] Received my suggestions:", suggestions);
      this.renderMySuggestions(suggestions);
    } catch (error) {
      console.error("[Moderator] Error loading own suggestions:", error);
      container.innerHTML = `<p class="text-red-500 text-center p-4">Failed to load suggestions: ${error.message}</p>`;
    }
  },

  renderMySuggestions(suggestions) {
    const container = this.elements.moderatorSuggestionsSection;
    if (!container) return;

    if (!Array.isArray(suggestions)) {
      console.error("[Moderator] Invalid suggestion data received.");
      container.innerHTML =
        '<p class="text-red-500 text-center p-4">Error: Invalid data.</p>';
      return;
    }

    if (suggestions.length === 0) {
      container.innerHTML =
        '<p class="text-center p-4 text-gray-500 dark:text-gray-400">You have not submitted any suggestions yet.</p>';
      return;
    }

    const formatBasicDate = (dateString) => {
      if (!dateString) return "N/A";
      try {
        return new Date(dateString).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch (e) {
        return "Invalid Date";
      }
    };

    const getStatusClass = (status) => {
      switch (status) {
        case "approved":
          return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
        case "rejected":
          return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
        case "pending":
        default:
          return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      }
    };

    const escapeHTML = (str) =>
      str ? str.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">") : "";

    container.innerHTML = `
          <h2 class="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600 dark:text-white">My Submitted Suggestions</h2>
          <div class="space-y-4">
              ${suggestions
                .map((suggestion) => {
                  const isNew = !suggestion.articleId;
                  const articleTitle = escapeHTML(
                    isNew
                      ? suggestion.proposedTitle || "(New Article Proposal)"
                      : suggestion.article?.title_en ||
                          `(Edit for Article ID: ${suggestion.articleId})`,
                  );
                  const submissionDate = formatBasicDate(suggestion.createdAt);
                  const updatedDate = formatBasicDate(
                    suggestion.updatedAt || suggestion.createdAt,
                  );
                  return `
                      <div class="p-4 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 shadow-sm">
                          <div class="flex flex-wrap justify-between items-start gap-2 mb-2">
                              <div>
                                  <span class="block font-semibold dark:text-white text-lg">
                                      ${articleTitle} ${isNew ? '<span class="text-xs font-normal text-blue-500 dark:text-blue-400">(New)</span>' : ""}
                                  </span>
                                  <span class="block text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      Submitted: ${submissionDate} | Last Update: ${updatedDate}
                                  </span>
                              </div>
                              <span class="text-xs font-medium px-2.5 py-0.5 rounded ${getStatusClass(suggestion.status)} capitalize self-center flex-shrink-0">
                                  ${escapeHTML(suggestion.status)}
                              </span>
                          </div>
                          ${
                            suggestion.status === "rejected" &&
                            suggestion.adminComments
                              ? `
                              <div class="mt-2 p-3 bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 rounded">
                                  <p class="text-sm font-semibold text-red-700 dark:text-red-300">Admin Feedback:</p>
                                  <p class="text-sm text-red-600 dark:text-red-200 italic">${escapeHTML(suggestion.adminComments)}</p>
                              </div>
                          `
                              : ""
                          }
                      </div>`;
                })
                .join("")}
          </div>`;
  },
  // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

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
      const article = await ApiService.getArticle(articleId);
      if (!article) throw new Error("Article not found");
      this.elements.articleId.value = article.id;
      this.elements.articleCategory.value = article.category || "";
      this.elements.articleAuthor.value = article.author || "";
      this.elements.articleImage.value = article.imageUrl || "";
      ["en", "rus", "mng"].forEach((lang) => {
        const titleInput = this.elements[`articleTitle_${lang}`];
        const excerptInput = this.elements[`articleExcerpt_${lang}`];
        const hiddenContentInput = this.elements[`articleContent_${lang}`];
        const quillInstance = this.quillInstances[lang];
        if (titleInput) titleInput.value = article[`title_${lang}`] || "";
        if (excerptInput) excerptInput.value = article[`excerpt_${lang}`] || "";
        const contentToLoad = article[`content_${lang}`] || "";
        if (quillInstance) quillInstance.root.innerHTML = contentToLoad;
        if (hiddenContentInput) hiddenContentInput.value = contentToLoad;
      });
      this.renderUIForRole(); // Update form button/heading text
      this.displayMessage(this.elements.articleFormMessage, "", false);
      this.elements.articleFormContainer.classList.remove("hidden");
      this.elements.articleForm.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (err) {
      console.error("Error loading article:", err);
      this.displayMessage(
        this.elements.articleFormMessage,
        `Error: ${err.message}`,
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
      const quill = this.quillInstances[lang];
      const input = this.elements[`articleContent_${lang}`];
      if (quill) quill.setText("");
      if (input) input.value = "";
    });
    this.elements.articleId.value = "";
    this.renderUIForRole(); // Reset button/heading text
    this.displayMessage(this.elements.articleFormMessage, "", false);
  },

  displayMessage(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.className = `mt-4 text-center text-sm ${isError ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
    element.classList.toggle("hidden", !message);
  },

  async handleLogin(event) {
    event.preventDefault();
    const form = this.elements.loginForm;
    const username = form.querySelector("#username")?.value.trim();
    const password = form.querySelector("#password")?.value;
    const messageEl = this.elements.loginMessage;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!username || !password)
      return this.displayMessage(
        messageEl,
        "Username and password required.",
        true,
      );
    this.displayMessage(messageEl, "Logging in...", false);
    if (submitBtn) submitBtn.disabled = true;

    try {
      const data = await ApiService.login(username, password);
      if (data && data.accessToken && data.refreshToken) {
        AuthService.setTokens(data.accessToken, data.refreshToken);
        this.displayMessage(messageEl, "Login successful!", false);
        if (form.querySelector("#password"))
          form.querySelector("#password").value = "";
        await this.updateUI();
      } else throw new Error("Unexpected login response.");
    } catch (err) {
      console.error("Login Failed:", err);
      let msg = err.message || "Unknown login error";
      let needsChange = false,
        changeToken = null;
      if (
        err.data?.needsPasswordChange === true &&
        err.data?.changePasswordToken
      ) {
        msg = err.data.message || msg;
        needsChange = true;
        changeToken = err.data.changePasswordToken;
      }
      if (needsChange && changeToken) {
        sessionStorage.setItem("changePasswordToken", changeToken);
        sessionStorage.setItem("changeUsername", username);
        this.displayMessage(messageEl, msg, true);
        alert(msg + " Redirecting...");
        setTimeout(
          () => (window.location.href = "/change-initial-password.html"),
          100,
        );
      } else {
        this.displayMessage(messageEl, `Login failed: ${msg}`, true);
        if (submitBtn) submitBtn.disabled = false;
      }
    }
    // No finally block needed here as button re-enabling is handled in error/success paths
  },

  async handleArticleSubmit(event) {
    event.preventDefault();
    const form = this.elements.articleForm;
    if (!form) return;
    const submitActionText = this.elements.articleSubmit?.textContent || "";
    const isSuggestion = submitActionText.includes("Suggestion");
    const articleId = this.elements.articleId.value;
    const messageEl = this.elements.articleFormMessage;
    const submitBtn = this.elements.articleSubmit;

    if (
      (isSuggestion && this.currentUserRole !== "moderator") ||
      (!isSuggestion && this.currentUserRole !== "admin")
    ) {
      return alert("Permission denied for this action.");
    }
    ["en", "rus", "mng"].forEach((lang) => {
      const quill = this.quillInstances[lang];
      const input = this.elements[`articleContent_${lang}`];
      if (quill && input) input.value = quill.root.innerHTML;
    });
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
    if (
      !articleData.title_en ||
      !articleData.content_en ||
      articleData.content_en === "<p><br></p>" ||
      !articleData.category ||
      !articleData.author
    ) {
      return this.displayMessage(
        messageEl,
        "Required fields: Eng Title, Eng Content, Category, Author.",
        true,
      );
    }
    let actionVerb = isSuggestion
      ? articleId
        ? "Suggesting Edit"
        : "Suggesting New"
      : articleId
        ? "Updating"
        : "Creating";
    this.displayMessage(messageEl, `${actionVerb} article...`, false);
    if (submitBtn) submitBtn.disabled = true;

    try {
      let resultMessage = "";
      if (isSuggestion) {
        const result = articleId
          ? await ApiService.suggestArticleEdit(articleId, articleData)
          : await ApiService.suggestNewArticle(articleData);
        resultMessage = result.message || "Suggestion submitted.";
        if (this.currentUserRole === "moderator")
          setTimeout(() => this.loadMySuggestions(), 1000);
      } else {
        const result = articleId
          ? await ApiService.updateArticle(articleId, articleData)
          : await ApiService.createArticle(articleData);
        resultMessage = articleId ? "Article updated!" : "Article created!";
        await this.loadArticles();
      }
      this.displayMessage(messageEl, resultMessage, false);
      this.resetForm();
      this.elements.articleFormContainer?.classList.add("hidden");
      setTimeout(() => {
        if (messageEl?.textContent.includes(resultMessage))
          this.displayMessage(messageEl, "", false);
      }, 5000);
    } catch (err) {
      console.error(`Article ${actionVerb} Error:`, err);
      let msg = `Error: ${err.message}`;
      if (err.data?.errors && Array.isArray(err.data.errors))
        msg = `Error: ${err.data.errors.map((e) => `${e.param || e.field || "Input"}: ${e.msg || e.message}`).join(", ")}`;
      this.displayMessage(messageEl, msg, true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  async handleDeleteArticle(articleId) {
    if (this.currentUserRole !== "admin" || !articleId) return;
    if (!confirm(`Delete article ID ${articleId}?`)) return;
    const button = this.elements.articlesContainer?.querySelector(
      `.delete-article[data-id="${articleId}"]`,
    );
    if (button) button.disabled = true;
    try {
      await ApiService.deleteArticle(articleId);
      this.loadArticles(); // Refresh list
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      if (button) button.disabled = false;
    }
  },

  handleNewArticleClick() {
    if (!this.elements.articleFormContainer) return;
    this.resetForm();
    this.renderUIForRole(); // Set correct heading/button
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
    AuthService.clearTokens();
    this.updateUI();
  },

  handleSuggestEditClick(articleId) {
    if (this.currentUserRole !== "moderator" || !articleId) return;
    this.loadArticleForEditing(articleId);
  },

  async handleCreateModeratorSubmit(event) {
    event.preventDefault();
    if (this.currentUserRole !== "admin" || !this.elements.createModeratorForm)
      return;
    const form = this.elements.createModeratorForm;
    const username = form.querySelector("#mod-username")?.value.trim();
    const email = form.querySelector("#mod-email")?.value.trim();
    const messageEl = this.elements.createModeratorMessage;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!username || !email)
      return this.displayMessage(
        messageEl,
        "Username and Email required.",
        true,
      );
    this.displayMessage(messageEl, "Creating...", false);
    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await ApiService.createUser({ username, email });
      this.displayMessage(
        messageEl,
        `Moderator '${username}' created. Temp PW: ${response.temporaryPassword}`,
        false,
      );
      form.reset();
      this.loadModerators();
      setTimeout(() => {
        if (messageEl?.textContent.includes("created"))
          this.displayMessage(messageEl, "", false);
      }, 15000);
    } catch (err) {
      let msg = `Failed create: ${err.message}`;
      if (err.data?.errors && Array.isArray(err.data.errors))
        msg = `Error: ${err.data.errors.map((e) => `${e.param || e.field || "Input"}: ${e.msg || e.message}`).join(", ")}`;
      this.displayMessage(messageEl, msg, true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  async handleApproveSuggestion(suggestionId, buttonElement) {
    if (this.currentUserRole !== "admin") return;
    const actionsContainer = buttonElement.closest(".suggestion-actions");
    const errorEl = actionsContainer?.querySelector(".error-message");
    const successEl = actionsContainer?.querySelector(".success-message");
    const rejectBtn = actionsContainer?.querySelector(".reject-suggestion");
    const viewBtn = actionsContainer?.querySelector(".view-suggestion");

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }
    if (successEl) successEl.classList.add("hidden");
    buttonElement.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;
    if (viewBtn) viewBtn.disabled = true;

    try {
      await ApiService.approveSuggestion(suggestionId);
      if (successEl) successEl.classList.remove("hidden");
      buttonElement
        .closest(".suggestion-item")
        ?.classList.add("opacity-50", "bg-green-50", "dark:bg-green-900/30");
      setTimeout(() => this.loadSuggestions(), 2000);
      setTimeout(() => this.loadArticles(), 2100);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = `Error: ${err.message}`;
        errorEl.classList.remove("hidden");
      } else alert(`Error: ${err.message}`);
      buttonElement.disabled = false;
      if (rejectBtn) rejectBtn.disabled = false;
      if (viewBtn) viewBtn.disabled = false;
    }
  },

  async handleRejectSuggestion(suggestionId, buttonElement) {
    if (this.currentUserRole !== "admin") return;
    const reason = prompt("Optional: Reason for rejection:");
    const actionsContainer = buttonElement.closest(".suggestion-actions");
    const errorEl = actionsContainer?.querySelector(".error-message");
    const rejectMsgEl = actionsContainer?.querySelector(".reject-message");
    const approveBtn = actionsContainer?.querySelector(".approve-suggestion");
    const viewBtn = actionsContainer?.querySelector(".view-suggestion");

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }
    if (rejectMsgEl) rejectMsgEl.classList.add("hidden");
    buttonElement.disabled = true;
    if (approveBtn) approveBtn.disabled = true;
    if (viewBtn) viewBtn.disabled = true;

    try {
      await ApiService.rejectSuggestion(suggestionId, reason);
      if (rejectMsgEl) rejectMsgEl.classList.remove("hidden");
      buttonElement
        .closest(".suggestion-item")
        ?.classList.add("opacity-50", "bg-red-50", "dark:bg-red-900/30");
      setTimeout(() => this.loadSuggestions(), 2000);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = `Error: ${err.message}`;
        errorEl.classList.remove("hidden");
      } else alert(`Error: ${err.message}`);
      buttonElement.disabled = false;
      if (approveBtn) approveBtn.disabled = false;
      if (viewBtn) viewBtn.disabled = false;
    }
  },
}; // End of AdminUI object

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("Admin page DOM fully loaded and parsed");
  AdminUI.initialize();
});
