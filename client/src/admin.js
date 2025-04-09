// client/src/admin.js
import "./style.css";

// --- API Service ---
const ApiService = {
  baseUrl: "https://localhost:3000/api",
  csrfToken: null,

  async fetchCsrfToken() {
    try {
      const response = await fetch(`${this.baseUrl}/csrf-token`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            `Failed fetch CSRF: ${response.status} Too Many Requests.`,
          );
        }
        throw new Error(`Failed fetch CSRF: ${response.status}`);
      }
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      throw error;
    }
  },

  async makeRequest(url, method = "GET", data = null, isRetry = false) {
    if (
      !this.csrfToken &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase()) &&
      !isRetry
    ) {
      try {
        await this.fetchCsrfToken();
      } catch (csrfError) {
        console.error("Failed pre-fetch CSRF token:", csrfError);
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
      const response = await fetch(url, options);
      if (response.status === 403 && !isRetry) {
        try {
          const errorJson = await response.clone().json();
          if (
            errorJson.message &&
            errorJson.message.toLowerCase() === "invalid csrf token"
          ) {
            console.warn("CSRF invalid, retrying ONCE...");
            this.csrfToken = null;
            await this.fetchCsrfToken();
            return this.makeRequest(url, method, data, true);
          }
        } catch (e) {
          console.error("Could not parse CSRF error:", e);
        }
      }
      if (response.status === 204) {
        return null;
      }
      if (!response.ok) {
        let errorData = {
          message: `Request failed: ${response.status} ${response.statusText}`,
        };
        let responseText = "";
        try {
          responseText = await response.text();
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData.responseText = responseText;
          console.warn(
            `Failed parse error response JSON ${method} ${url}. Raw: ${responseText.substring(0, 100)}...`,
          );
        }
        const errors = errorData.errors;
        const errorMessage =
          errorData.message || `Request failed: ${response.status}`;
        console.error(`Request failed: ${response.status}`, errorData);
        const error = new Error(errorMessage);
        error.statusCode = response.status;
        error.data = errorData;
        throw error;
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        const text = await response.text();
        console.log(`Non-JSON response for ${method} ${url}`, text);
        return text;
      } // Return text for non-JSON OK response
    } catch (networkError) {
      console.error(`API error during ${method} ${url}:`, networkError);
      const errorToThrow = new Error(networkError.message || `Network error.`);
      if (networkError.statusCode) {
        errorToThrow.statusCode = networkError.statusCode;
      }
      if (networkError.data) {
        errorToThrow.data = networkError.data;
      }
      if (networkError.errors) {
        errorToThrow.errors = networkError.errors;
      }
      throw errorToThrow;
    }
  },

  async login(username, password) {
    try {
      return await this.makeRequest(`${this.baseUrl}/admin/login`, "POST", {
        username,
        password,
      });
    } catch (error) {
      throw error;
    }
  },
  async refreshToken() {
    const r = localStorage.getItem("refreshToken");
    if (!r) return null;
    try {
      const d = await this.makeRequest(
        `${this.baseUrl}/admin/refresh`,
        "POST",
        { refreshToken: r },
      );
      return d.accessToken;
    } catch (e) {
      console.error("Refresh token failed:", e);
      AuthService.clearTokens();
      throw e;
    }
  },
  async makeAuthenticatedRequest(url, method = "GET", data = null) {
    try {
      return await this.makeRequest(url, method, data);
    } catch (error) {
      const s = error.statusCode;
      if (
        s === 401 ||
        s === 403 ||
        error.message.includes("401") ||
        error.message.includes("Forbidden") ||
        error.message.includes("403")
      ) {
        console.warn(
          `Auth error (${s || "N/A"}) on ${method} ${url}, attempting refresh...`,
        );
        try {
          const t = await this.refreshToken();
          if (t) {
            localStorage.setItem("accessToken", t);
            console.log(`Retrying ${method} ${url} with new token.`);
            return await this.makeRequest(url, method, data);
          } else {
            console.error("Refresh failed. Clearing session.");
            AuthService.clearTokens();
            window.location.href = "/admin.html";
            throw new Error("Session expired. Log in again.");
          }
        } catch (r) {
          console.error("Error during refresh attempt:", r);
          AuthService.clearTokens();
          window.location.href = "/admin.html";
          throw new Error("Session expired. Log in again.");
        }
      } else {
        console.error(`Non-auth error on ${method} ${url}:`, error);
        throw error;
      }
    }
  },
  async getMe() {
    return this.makeAuthenticatedRequest(`${this.baseUrl}/admin/me`);
  },
  async getArticles() {
    return this.makeAuthenticatedRequest(`${this.baseUrl}/articles/all`);
  },
  async getArticle(id) {
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
  async getUsers(filters = {}) {
    let q = "";
    if (filters.role) {
      q = `?role=${encodeURIComponent(filters.role)}`;
    }
    return this.makeAuthenticatedRequest(`${this.baseUrl}/admin/users${q}`);
  },
  async createUser(userData) {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/users`,
      "POST",
      userData,
    );
  },
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
    const q = `?status=${encodeURIComponent(status)}`;
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions${q}`,
    );
  },
  async getSuggestionDetails(suggestionId) {
    if (!suggestionId) throw new Error("Suggestion ID required.");
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}`,
    );
  },
  async approveSuggestion(suggestionId) {
    if (!suggestionId) throw new Error("Suggestion ID required.");
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}/approve`,
      "POST",
    );
  },
  async rejectSuggestion(suggestionId, adminComments = null) {
    if (!suggestionId) throw new Error("Suggestion ID required.");
    const body = adminComments ? { adminComments } : null;
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}/reject`,
      "POST",
      body,
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
    console.log("Tokens cleared.");
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
    manageModeratorsButtonWrapper: document.getElementById(
      "manage-moderators-button-wrapper",
    ),
    manageModeratorsButton: document.getElementById("manage-moderators-button"),
    moderatorsSection: document.getElementById("moderators-section"),
    moderatorsListContainer: document.getElementById(
      "moderators-list-container",
    ),
    createModeratorForm: document.getElementById("create-moderator-form"),
    createModeratorMessage: document.getElementById("create-moderator-message"),
    suggestionsListContainer: document.getElementById(
      "suggestions-list-container",
    ),
    suggestionModal: document.getElementById("suggestion-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalCloseButton: document.getElementById("modal-close-button"),
  },
  currentUserRole: null,
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
          // Sync Quill content to hidden input on change
          this.quillInstances[lang].on("text-change", () => {
            // Check if instance still exists (might be destroyed on form reset/hide?)
            if (this.quillInstances[lang]) {
              hiddenInput.value = this.quillInstances[lang].root.innerHTML;
            }
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
        console.warn(
          `Quill container/input elements not found for language: ${lang}`,
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
    this.elements.createModeratorForm?.addEventListener(
      "submit",
      this.handleCreateModeratorSubmit.bind(this),
    );
    this.elements.manageModeratorsButton?.addEventListener(
      "click",
      this.handleManageModeratorsClick.bind(this),
    ); // Use bound method
    this.elements.suggestionsListContainer?.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        const suggestionId = button.dataset.suggestionId;
        if (!suggestionId) return;
        if (button.classList.contains("approve-suggestion")) {
          this.handleApproveSuggestion(suggestionId, button);
        } else if (button.classList.contains("reject-suggestion")) {
          this.handleRejectSuggestion(suggestionId, button);
        } else if (button.classList.contains("view-suggestion")) {
          this.showSuggestionDetails(suggestionId);
        }
      },
    );
    this.elements.modalCloseButton?.addEventListener("click", () =>
      this.closeSuggestionModal(),
    );
    this.elements.suggestionModal?.addEventListener("click", (event) => {
      if (event.target === this.elements.suggestionModal) {
        this.closeSuggestionModal();
      }
    });
  },

  handleManageModeratorsClick() {
    console.log("[AdminUI] Manage Moderators button clicked.");
    this.elements.moderatorsSection?.classList.toggle("hidden");
    if (!this.elements.moderatorsSection?.classList.contains("hidden")) {
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
        if (userInfo && userInfo.role) {
          this.currentUserRole = userInfo.role;
          console.log("[Admin UI] Role:", this.currentUserRole);
        } else {
          console.error("[Admin UI] No role.");
          AuthService.clearTokens();
          window.location.reload();
          return;
        }
        this.renderUIForRole();
        this.loadArticles();
      } catch (error) {
        console.error("[Admin UI] Error getting user info:", error);
        AuthService.clearTokens();
        this.elements.loginPanel?.classList.remove("hidden");
        this.elements.adminPanel?.classList.add("hidden");
        this.clearAdminContent();
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
    this.elements.newArticleButton?.classList.add("hidden");
    if (this.currentUserRole === "admin") {
      console.log("[Admin UI] Render ADMIN");
      this.elements.manageModeratorsButtonWrapper?.classList.remove("hidden");
      this.elements.newArticleButton?.classList.remove("hidden");
      if (this.elements.newArticleButton)
        this.elements.newArticleButton.textContent = "Create New Article";
    } else if (this.currentUserRole === "moderator") {
      console.log("[Admin UI] Render MODERATOR");
      if (this.elements.newArticleButton) {
        this.elements.newArticleButton.textContent = "Suggest New Article";
        this.elements.newArticleButton.classList.remove("hidden");
      }
    } else {
      console.log("[Admin UI] Render UNKNOWN");
    }
    // Only reload articles if container exists and isn't showing 'loading'
    if (
      this.elements.articlesContainer?.innerHTML &&
      !this.elements.articlesContainer.innerHTML.includes("Loading articles...")
    ) {
      this.loadArticles();
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
  },

  async loadArticles() {
    if (!this.elements.articlesContainer) return;
    this.elements.articlesContainer.innerHTML =
      '<p class="text-center p-4 col-span-full">Loading articles...</p>';
    try {
      const articlesArray = await ApiService.getArticles();
      if (!Array.isArray(articlesArray)) {
        throw new Error(
          "Received unexpected data format fetching articles list.",
        );
      }
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
        const title = article.title || article.title_en || "Untitled";
        const category = article.category || "?";
        const author = article.author || "?";
        const imageUrl = article.imageUrl;
        const status = article.status || "?";
        let buttonsHTML = "";
        if (this.currentUserRole === "admin") {
          buttonsHTML = ` <button class="edit-article btn btn-blue text-sm py-1 px-3" data-id="${article.id}">Edit</button> <button class="delete-article btn btn-red text-sm py-1 px-3" data-id="${article.id}">Delete</button> `;
        } else if (this.currentUserRole === "moderator") {
          buttonsHTML = ` <button class="suggest-edit-article btn btn-blue text-sm py-1 px-3" data-id="${article.id}">Suggest Edit</button> `;
        }
        return ` <div class="article-card border dark:border-gray-600 rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-700 flex flex-col"> ${imageUrl ? `<img src="${imageUrl}" alt="${title}" class="w-full h-48 object-cover">` : '<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300">No Image</div>'} <div class="p-4 flex flex-col flex-grow"> <h3 class="text-lg font-bold mb-1 dark:text-white flex-grow">${title}</h3> <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Cat: ${category}</p> <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">By: ${author}</p> <p class="text-sm font-medium ${status === "published" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"} mb-2 capitalize">Status: ${status}</p> <div class="mt-auto pt-2 flex space-x-2"> ${buttonsHTML} </div> </div> </div> `;
      })
      .join("");
    this.elements.articlesContainer
      .querySelectorAll(".edit-article")
      .forEach((button) => {
        button.addEventListener("click", (e) =>
          this.loadArticleForEditing(e.currentTarget.dataset.id),
        );
      });
    this.elements.articlesContainer
      .querySelectorAll(".delete-article")
      .forEach((button) => {
        button.addEventListener("click", (e) =>
          this.handleDeleteArticle(e.currentTarget.dataset.id),
        );
      });
    this.elements.articlesContainer
      .querySelectorAll(".suggest-edit-article")
      .forEach((button) => {
        button.addEventListener("click", (e) =>
          this.handleSuggestEditClick(e.currentTarget.dataset.id),
        );
      });
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
    this.elements.moderatorsListContainer.innerHTML = ` <ul class="space-y-2"> ${moderators.map((mod) => ` <li class="flex justify-between items-center p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-800"> <span>${mod.username} (<span class="text-xs text-gray-500 dark:text-gray-400">${mod.email}</span>) ${mod.needsPasswordChange ? '<span class="text-xs text-orange-500 ml-2 font-semibold">(Needs PW Reset)</span>' : ""}</span> </li> `).join("")} </ul>`;
  },

  async loadSuggestions() {
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
      console.log("[Admin] Received suggestions data from API:", suggestions);
      this.renderSuggestions(suggestions);
    } catch (error) {
      console.error("[Admin] Error loading suggestions:", error);
      this.elements.suggestionsListContainer.innerHTML = `<p class="text-red-500 text-center p-4">Failed to load suggestions: ${error.message}</p>`;
    }
  },

  renderSuggestions(suggestions) {
    if (
      this.currentUserRole !== "admin" ||
      !this.elements.suggestionsListContainer
    )
      return;
    console.log("[Admin] renderSuggestions called with:", suggestions);
    if (!Array.isArray(suggestions)) {
      console.error("[Admin] renderSuggestions received non-array.");
      this.elements.suggestionsListContainer.innerHTML =
        '<p class="text-red-500 text-center p-4">Error: Invalid suggestion data received.</p>';
      return;
    }
    if (suggestions.length === 0) {
      console.log("[Admin] No pending suggestions found to render.");
      this.elements.suggestionsListContainer.innerHTML =
        '<p class="text-center p-4 text-gray-500 dark:text-gray-400">No pending suggestions found.</p>';
      return;
    }
    console.log(`[Admin] Rendering ${suggestions.length} suggestions.`);
    this.elements.suggestionsListContainer.innerHTML = suggestions
      .map((suggestion) => {
        let articleTitle;
        if (suggestion.articleId && suggestion.article) {
          articleTitle =
            suggestion.article.title_en ||
            `Article ID: ${suggestion.articleId}`;
        } else {
          articleTitle =
            suggestion.proposedData?.title_en || "(New Article Proposal)";
          articleTitle +=
            ' <span class="text-xs font-normal text-blue-500 dark:text-blue-400">(New)</span>';
        }
        const moderatorName =
          suggestion.moderator?.username ||
          `User ID: ${suggestion.moderatorId}`;
        const suggestionDate = suggestion.createdAt
          ? new Date(suggestion.createdAt).toLocaleDateString()
          : "?";
        const isNew = !suggestion.articleId;
        return ` <div class="suggestion-item p-3 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 shadow-sm"> <div class="flex flex-wrap justify-between items-center gap-2 mb-2"> <div> <span class="block font-semibold dark:text-white">Article: ${articleTitle}</span> <span class="block text-sm text-gray-600 dark:text-gray-400">By: ${moderatorName} on ${suggestionDate}</span> </div> <div class="flex justify-end items-center gap-2 mt-2 sm:mt-0 suggestion-actions flex-shrink-0"> <span class="text-sm text-green-600 dark:text-green-400 hidden success-message">Approved!</span> <span class="text-sm text-red-600 dark:text-red-400 hidden reject-message">Rejected!</span> <span class="text-sm text-red-600 dark:text-red-400 hidden error-message"></span> <button class="view-suggestion btn btn-gray text-xs py-1 px-2" data-suggestion-id="${suggestion.id}" data-is-new="${isNew}">Details</button> <button class="reject-suggestion btn btn-red text-xs py-1 px-2" data-suggestion-id="${suggestion.id}" data-is-new="${isNew}">Reject</button> <button class="approve-suggestion btn btn-green text-xs py-1 px-2" data-suggestion-id="${suggestion.id}" data-is-new="${isNew}">Approve</button> </div> </div> </div>`;
      })
      .join("");
  },

  async showSuggestionDetails(suggestionId) {
    if (!this.elements.suggestionModal || !this.elements.modalBody) return;
    console.log(`[Admin] Showing details for suggestion ${suggestionId}`);
    this.elements.modalBody.innerHTML =
      '<p class="p-4 text-center">Loading details...</p>';
    this.elements.suggestionModal.classList.remove("hidden");
    this.elements.suggestionModal.classList.add("flex");
    try {
      const suggestion = await ApiService.getSuggestionDetails(suggestionId);
      if (!suggestion || !suggestion.proposedData) {
        throw new Error("Suggestion data or proposed changes missing.");
      }
      const proposed = suggestion.proposedData;
      const isNew = !suggestion.articleId;
      const articleTitle = isNew
        ? suggestion.proposedData?.title_en || "(New Article Proposal)"
        : suggestion.article?.title_en || `Article ID: ${suggestion.articleId}`;
      const moderatorName =
        suggestion.moderator?.username || `User ID: ${suggestion.moderatorId}`;
      if (this.elements.modalTitle) {
        this.elements.modalTitle.textContent = `Suggestion for: ${articleTitle} ${isNew ? "(New)" : ""}`;
      }
      this.elements.modalBody.innerHTML = ` <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Submitted by: ${moderatorName}</p> <div class="space-y-4"> <h4 class="font-bold text-lg border-b dark:border-gray-600 pb-1 mb-2">Proposed Changes:</h4> ${this.renderProposedField("Title (EN)", proposed.title_en)} ${this.renderProposedField("Content (EN)", proposed.content_en, true)} ${this.renderProposedField("Excerpt (EN)", proposed.excerpt_en)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Title (RU)", proposed.title_rus)} ${this.renderProposedField("Content (RU)", proposed.content_rus, true)} ${this.renderProposedField("Excerpt (RU)", proposed.excerpt_rus)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Title (MN)", proposed.title_mng)} ${this.renderProposedField("Content (MN)", proposed.content_mng, true)} ${this.renderProposedField("Excerpt (MN)", proposed.excerpt_mng)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Category", proposed.category)} ${this.renderProposedField("Author", proposed.author)} ${this.renderProposedField("Image URL", proposed.imageUrl)} </div>`;
    } catch (error) {
      console.error(
        `Error fetching suggestion details ${suggestionId}:`,
        error,
      );
      this.elements.modalBody.innerHTML = `<p class="p-4 text-center text-red-500">Error loading details: ${error.message}</p>`;
    }
  },

  renderProposedField(label, value, isHtml = false) {
    const displayValue =
      value || '<span class="text-gray-400 italic"> (empty/no change)</span>';
    return ` <div class="mb-2"> <strong class="block text-sm font-medium text-gray-700 dark:text-gray-300">${label}:</strong> ${isHtml ? `<div class="mt-1 text-sm text-gray-900 dark:text-gray-100 prose prose-sm dark:prose-invert max-w-none">${displayValue}</div>` : `<span class="mt-1 text-sm text-gray-900 dark:text-gray-100">${displayValue}</span>`} </div>`;
  },

  closeSuggestionModal() {
    if (!this.elements.suggestionModal) return;
    this.elements.suggestionModal.classList.add("hidden");
    this.elements.suggestionModal.classList.remove("flex");
    if (this.elements.modalBody) this.elements.modalBody.innerHTML = "";
    if (this.elements.modalTitle)
      this.elements.modalTitle.textContent = "Suggestion Details";
  },

  async loadArticleForEditing(articleId) {
    if (!this.elements.articleFormContainer || !this.elements.articleForm)
      return;
    this.displayMessage(
      this.elements.articleFormMessage,
      "Loading article data...",
      !1,
    );
    this.elements.articleSubmit.disabled = !0;
    try {
      const article = await ApiService.getArticle(articleId);
      if (!article) throw new Error("Article not found by API");
      this.elements.articleId.value = article.id;
      this.elements.articleCategory.value = article.category;
      this.elements.articleAuthor.value = article.author;
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
      this.elements.articleSubmit.textContent =
        this.currentUserRole === "admin"
          ? "Update Article"
          : "Submit Suggestion";
      this.elements.formHeading &&
        (this.elements.formHeading.textContent =
          this.currentUserRole === "admin"
            ? "Edit Article"
            : "Suggest Edits For Article");
      this.displayMessage(this.elements.articleFormMessage, "", !1);
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
        !0,
      );
    } finally {
      this.elements.articleSubmit.disabled = !1;
    }
  },
  resetForm() {
    if (!this.elements.articleForm) return;
    this.elements.articleForm.reset();
    ["en", "rus", "mng"].forEach((e) => {
      const t = this.quillInstances[e],
        n = this.elements[`articleContent_${e}`];
      t && (t.root.innerHTML = "");
      n && (n.value = "");
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
  displayMessage(e, t, n = !1) {
    if (!e) return void console.warn("Message element missing.");
    e.textContent = t;
    e.className = `mt-4 text-center text-sm ${n ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
  },

  // --- Event Handlers ---
  async handleLogin(event) {
    /* ... keep implementation ... */ console.log(
      "[Login Attempt] Form submitted.",
    );
    if (!event) {
      console.error("[Login Attempt] Event missing!");
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    console.log("[Login Attempt] Default prevented.");
    if (!this.elements.loginForm) return;
    const usernameInput = this.elements.loginForm.querySelector("#username");
    const passwordInput = this.elements.loginForm.querySelector("#password");
    const username = usernameInput?.value.trim();
    const password = passwordInput?.value;
    if (!username || !password) {
      this.displayMessage(
        this.elements.loginMessage,
        "Username and password required.",
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
      console.log("[Login Attempt] Calling ApiService.login...");
      const data = await ApiService.login(username, password);
      if (data && data.accessToken) {
        console.log("[Login Attempt] ApiService.login SUCCESS:", data);
        AuthService.setTokens(data.accessToken, data.refreshToken);
        this.displayMessage(
          this.elements.loginMessage,
          "Login successful!",
          false,
        );
        await this.updateUI();
      } else {
        console.error("[Login Attempt] Unexpected success response:", data);
        throw new Error("Unexpected login response.");
      }
    } catch (err) {
      console.error("[Login Attempt] ApiService.login FAILED:", err);
      let errorMessage = err.message || "An unknown error occurred";
      let needsChange = false;
      let changeToken = null;
      if (
        err.data &&
        err.data.needsPasswordChange === true &&
        err.data.changePasswordToken
      ) {
        console.log(
          "[Login Attempt] Password change required (from err.data).",
        );
        errorMessage = err.data.message || errorMessage;
        needsChange = true;
        changeToken = err.data.changePasswordToken;
      } else if (
        err.statusCode === 400 &&
        err.message.includes("Password change required")
      ) {
        console.log(
          "[Login Attempt] Password change required (from status/message). Needs token check.",
        );
        if (err.data && err.data.changePasswordToken) {
          needsChange = true;
          changeToken = err.data.changePasswordToken;
        } else {
          errorMessage =
            "Password change required, but token missing. Contact admin.";
        }
      }
      if (needsChange && changeToken) {
        sessionStorage.setItem("changePasswordToken", changeToken);
        sessionStorage.setItem("changeUsername", username);
        this.displayMessage(this.elements.loginMessage, errorMessage, true);
        alert(errorMessage + " Redirecting...");
        console.log("[Login Attempt] Scheduling redirect...");
        setTimeout(() => {
          console.log("[Login Attempt] Executing redirect.");
          window.location.href = "/change-initial-password.html";
        }, 50);
      } else {
        this.displayMessage(
          this.elements.loginMessage,
          `Login failed: ${errorMessage}`,
          true,
        );
      }
    } finally {
      console.log("[Login Attempt] Finally block.");
      if (submitButton) submitButton.disabled = false;
    }
  },
  async handleArticleSubmit(e) {
    /* ... keep implementation ... */ e.preventDefault();
    if (!this.elements.articleForm) return;
    const submitAction = this.elements.articleSubmit?.textContent || "";
    const isSuggestion = submitAction.includes("Suggestion");
    if (isSuggestion && this.currentUserRole !== "moderator") {
      alert("Only mods can suggest.");
      return;
    }
    if (!isSuggestion && this.currentUserRole !== "admin") {
      alert("Only admins can create/update.");
      return;
    }
    ["en", "rus", "mng"].forEach((lang) => {
      const quill = this.quillInstances[lang];
      const input = this.elements[`articleContent_${lang}`];
      if (quill && input) input.value = quill.root.innerHTML;
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
    if (
      !articleData.title_en ||
      !articleData.content_en ||
      !articleData.category ||
      !articleData.author
    ) {
      this.displayMessage(
        this.elements.articleFormMessage,
        "Eng Title, Content, Cat, Author required.",
        true,
      );
      return;
    }
    let action = articleId
      ? isSuggestion
        ? "Suggesting Update for"
        : "Updating"
      : isSuggestion
        ? "Suggesting New Article"
        : "Creating";
    if (!articleId && isSuggestion) action = "Suggesting New Article";
    console.log(
      `${action} article ${articleId ? `(ID: ${articleId})` : ""}...`,
    );
    this.displayMessage(
      this.elements.articleFormMessage,
      `${action}...`,
      false,
    );
    if (this.elements.articleSubmit)
      this.elements.articleSubmit.disabled = true;
    try {
      let resultMessage = "";
      if (isSuggestion) {
        let result;
        if (articleId) {
          result = await ApiService.suggestArticleEdit(articleId, articleData);
          resultMessage = result.message || "Edit suggestion submitted.";
        } else {
          result = await ApiService.suggestNewArticle(articleData);
          resultMessage = result.message || "New article suggestion submitted.";
        }
        this.displayMessage(
          this.elements.articleFormMessage,
          resultMessage,
          false,
        );
      } else {
        let result;
        if (articleId) {
          result = await ApiService.updateArticle(articleId, articleData);
          resultMessage = "Article updated!";
        } else {
          result = await ApiService.createArticle(articleData);
          resultMessage = "Article created!";
        }
        console.log(`Article ${action} successful:`, result?.id);
        this.displayMessage(
          this.elements.articleFormMessage,
          resultMessage,
          false,
        );
        await this.loadArticles();
      }
      this.resetForm();
      this.elements.articleFormContainer?.classList.add("hidden");
      setTimeout(() => {
        if (
          this.elements.articleFormMessage?.textContent.includes("success") ||
          this.elements.articleFormMessage?.textContent.includes("submitted")
        ) {
          this.displayMessage(this.elements.articleFormMessage, "", false);
        }
      }, 5000);
    } catch (err) {
      console.error(`Article ${action} Error:`, err);
      let msg = `Error: ${err.message}`;
      if (err.errors) {
        msg = `Error: ${err.errors.map((e) => `${e.field || "Input"}: ${e.msg || e.message}`).join(", ")}`;
      }
      this.displayMessage(this.elements.articleFormMessage, msg, true);
    } finally {
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.disabled = false;
    }
  },
  async handleDeleteArticle(articleId) {
    /* ... keep implementation ... */ if (
      !articleId ||
      "admin" !== this.currentUserRole
    )
      return;
    if (!confirm(`Delete article ID ${articleId}?`)) return;
    console.log(`Deleting article ${articleId}...`);
    try {
      await ApiService.deleteArticle(articleId);
      console.log(`Article ${articleId} deleted.`);
      alert(`Article ${articleId} deleted.`);
      this.loadArticles();
    } catch (err) {
      console.error("Error deleting:", err);
      alert(`Failed delete: ${err.message}`);
    }
  },
  handleNewArticleClick() {
    /* ... keep implementation ... */ if (!this.elements.articleFormContainer)
      return;
    this.resetForm();
    if (this.currentUserRole === "admin") {
      if (this.elements.formHeading)
        this.elements.formHeading.textContent = "Create New Article";
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.textContent = "Create Article";
    } else if (this.currentUserRole === "moderator") {
      if (this.elements.formHeading)
        this.elements.formHeading.textContent = "Suggest New Article";
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.textContent = "Submit Suggestion";
    }
    this.elements.articleFormContainer.classList.remove("hidden");
    this.elements.articleForm?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  },
  handleCancelClick() {
    /* ... keep implementation ... */ if (!this.elements.articleFormContainer)
      return;
    this.resetForm();
    this.elements.articleFormContainer.classList.add("hidden");
  },
  handleLogout() {
    /* ... keep implementation ... */ console.log("Logout.");
    AuthService.clearTokens();
    this.updateUI();
  },
  handleSuggestEditClick(articleId) {
    /* ... keep implementation ... */ if ("moderator" !== this.currentUserRole)
      return;
    console.log(`[Mod] Suggest edit ID: ${articleId}`);
    this.loadArticleForEditing(articleId);
    setTimeout(() => {
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.textContent = "Submit Suggestion";
    }, 100);
  },
  async handleCreateModeratorSubmit(e) {
    /* ... keep implementation ... */ e.preventDefault();
    if ("admin" !== this.currentUserRole || !this.elements.createModeratorForm)
      return;
    const t = this.elements.createModeratorForm.querySelector("#mod-username"),
      n = this.elements.createModeratorForm.querySelector("#mod-email"),
      l = this.elements.createModeratorMessage,
      o = t?.value.trim(),
      s = n?.value.trim();
    if (!o || !s)
      return void this.displayMessage(l, "Username and Email required.", !0);
    this.displayMessage(l, "Creating...", !1);
    const i = this.elements.createModeratorForm.querySelector(
      'button[type="submit"]',
    );
    i && (i.disabled = !0);
    try {
      const e = await ApiService.createUser({ username: o, email: s });
      this.displayMessage(
        l,
        `Moderator ${o} created. Temp PW: ${e.temporaryPassword}`,
        !1,
      );
      this.elements.createModeratorForm.reset();
      this.loadModerators();
      setTimeout(() => {
        l?.textContent.includes("created") && this.displayMessage(l, "", !1);
      }, 1e4);
    } catch (e) {
      console.error("[Admin] Error creating moderator:", e);
      let t = `Failed create: ${e.message}`;
      e.errors &&
        Array.isArray(e.errors) &&
        (t = `Error: ${e.errors.map((e) => `${e.field || "Input"}: ${e.msg || e.message}`).join(", ")}`);
      this.displayMessage(l, t, !0);
    } finally {
      i && (i.disabled = !1);
    }
  },
  async handleApproveSuggestion(suggestionId, buttonElement) {
    /* ... keep implementation ... */ if (this.currentUserRole !== "admin")
      return;
    console.log(`[Admin] Approving suggestion ${suggestionId}...`);
    const t = buttonElement.closest(".suggestion-actions"),
      n = t?.querySelector(".error-message"),
      l = t?.querySelector(".success-message");
    n && ((n.textContent = ""), n.classList.add("hidden"));
    l && l.classList.add("hidden");
    buttonElement.disabled = !0;
    t?.querySelector(".reject-suggestion")?.setAttribute("disabled", "true");
    try {
      const e = await ApiService.approveSuggestion(suggestionId);
      console.log(`[Admin] Suggestion ${suggestionId} approved:`, e);
      l && l.classList.remove("hidden");
      buttonElement
        .closest(".suggestion-item")
        ?.classList.add("opacity-50", "bg-green-50", "dark:bg-green-900/30");
      setTimeout(() => this.loadSuggestions(), 2e3);
    } catch (e) {
      console.error(`[Admin] Error approving suggestion ${suggestionId}:`, e);
      if (n) {
        n.textContent = `Error: ${e.message}`;
        n.classList.remove("hidden");
      } else alert(`Error approving: ${e.message}`);
      buttonElement.disabled = !1;
      t?.querySelector(".reject-suggestion")?.removeAttribute("disabled");
    }
  },
  async handleRejectSuggestion(suggestionId, buttonElement) {
    /* ... keep implementation ... */ if (this.currentUserRole !== "admin")
      return;
    const t = prompt("Optional: Enter reason for rejection:");
    console.log(`[Admin] Rejecting suggestion ${suggestionId}... Reason: ${t}`);
    const n = buttonElement.closest(".suggestion-actions"),
      l = n?.querySelector(".error-message"),
      o = n?.querySelector(".reject-message");
    l && ((l.textContent = ""), l.classList.add("hidden"));
    o && o.classList.add("hidden");
    buttonElement.disabled = !0;
    n?.querySelector(".approve-suggestion")?.setAttribute("disabled", "true");
    try {
      const e = await ApiService.rejectSuggestion(suggestionId, t);
      console.log(`[Admin] Suggestion ${suggestionId} rejected:`, e);
      o && o.classList.remove("hidden");
      buttonElement
        .closest(".suggestion-item")
        ?.classList.add("opacity-50", "bg-red-50", "dark:bg-red-900/30");
      setTimeout(() => this.loadSuggestions(), 2e3);
    } catch (e) {
      console.error(`[Admin] Error rejecting suggestion ${suggestionId}:`, e);
      if (l) {
        l.textContent = `Error: ${e.message}`;
        l.classList.remove("hidden");
      } else alert(`Error rejecting: ${e.message}`);
      buttonElement.disabled = !1;
      n?.querySelector(".approve-suggestion")?.removeAttribute("disabled");
    }
  },
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  AdminUI.initialize();
});
