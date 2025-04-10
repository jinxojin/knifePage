// client/src/admin.js
import "./style.css";

console.log("--- admin.js executing ---");

// --- API Service ---
const ApiService = {
  baseUrl: "/api",
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
        return null; // Successful DELETE or PUT with no body
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
        error.data = errorData; // Attach full error data object
        console.error(
          `API Request Failed: ${error.statusCode} - ${error.message}`,
          error.data,
        );
        throw error;
      }

      // Process successful responses
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json(); // Parse JSON response
      } else {
        // Handle non-JSON success responses (should be rare for this API)
        const text = await response.text();
        console.log(
          `Received non-JSON OK response for ${method} ${fetchPath}:`,
          text.substring(0, 100) + "...",
        );
        return text; // Return as text
      }
    } catch (networkOrProcessingError) {
      // Catch fetch failures (network errors) or errors thrown above
      console.error(
        `API Error during ${method} ${fetchPath}:`,
        networkOrProcessingError,
      );
      // Ensure the thrown error has a standard structure if possible
      const errorToThrow = new Error(
        networkOrProcessingError.message ||
          `Network or processing error occurred.`,
      );
      errorToThrow.statusCode = networkOrProcessingError.statusCode || 500; // Default to 500 if no status code
      errorToThrow.data = networkOrProcessingError.data || {}; // Include original error data if available
      throw errorToThrow; // Re-throw the standardized error
    }
  },

  // --- Authentication ---
  async login(username, password) {
    return this.makeRequest(`${this.baseUrl}/admin/login`, "POST", {
      username,
      password,
    });
  },

  async refreshToken() {
    const currentRefreshToken = localStorage.getItem("refreshToken");
    if (!currentRefreshToken) {
      console.log("No refresh token found in localStorage.");
      return null;
    }
    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/admin/refresh`,
        "POST",
        { refreshToken: currentRefreshToken },
      );
      console.log("Refresh token successful.");
      return data.accessToken;
    } catch (error) {
      console.error("Refresh token failed:", error);
      AuthService.clearTokens();
      throw error;
    }
  },

  async makeAuthenticatedRequest(url, method = "GET", data = null) {
    try {
      return await this.makeRequest(url, method, data);
    } catch (error) {
      const statusCode = error.statusCode;
      if (statusCode === 401 || statusCode === 403) {
        console.warn(
          `Auth error (${statusCode}) on ${method} ${url}. Attempting refresh...`,
        );
        try {
          const newAccessToken = await this.refreshToken();
          if (newAccessToken) {
            localStorage.setItem("accessToken", newAccessToken);
            console.log(`Retrying ${method} ${url} with new token.`);
            return await this.makeRequest(url, method, data); // Retry with original full URL
          } else {
            console.error("Refresh failed. Redirecting to login.");
            AuthService.clearTokens();
            window.location.href = "/admin.html";
            throw new Error("Session expired. Log in again.");
          }
        } catch (refreshError) {
          console.error("Error during refresh attempt:", refreshError);
          // Token clearing and redirect likely already happened in refreshToken
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

  // --- Articles ---
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

  // --- Users (Admin) ---
  async getUsers(filters = {}) {
    let queryString = "";
    if (filters.role) queryString = `?role=${encodeURIComponent(filters.role)}`;
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
  // +++ Add deleteUser method +++
  async deleteUser(userId) {
    if (!userId || typeof userId !== "number" || userId <= 0) {
      throw new Error("Invalid User ID provided for deletion.");
    }
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/users/${userId}`,
      "DELETE",
    );
  },
  // +++++++++++++++++++++++++++++

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
    // Admin view
    const queryString = `?status=${encodeURIComponent(status)}`;
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions${queryString}`,
    );
  },
  async getSuggestionDetails(suggestionId) {
    // Admin view detail
    if (!suggestionId) throw new Error("Suggestion ID required.");
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}`,
    );
  },
  async approveSuggestion(suggestionId) {
    // Admin action
    if (!suggestionId) throw new Error("Suggestion ID required.");
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}/approve`,
      "POST",
    );
  },
  async rejectSuggestion(suggestionId, adminComments = null) {
    // Admin action
    if (!suggestionId) throw new Error("Suggestion ID required.");
    const body = adminComments ? { adminComments } : {};
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/${suggestionId}/reject`,
      "POST",
      body,
    );
  },
  // Method for moderators to get their own suggestions
  async getMySuggestions() {
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/suggestions/my`,
    );
  },
}; // End of ApiService

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
    ApiService.csrfToken = null;
    console.log("Tokens cleared from localStorage.");
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
    createModeratorMessage: document.getElementById("create-moderator-message"),
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
    suggestionsListContainer: document.getElementById(
      "suggestions-list-container",
    ),
    moderatorSuggestionsSection: document.getElementById(
      "moderator-suggestions-section",
    ),
    suggestionModal: document.getElementById("suggestion-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalCloseButton: document.getElementById("modal-close-button"),
  },
  currentUserRole: null,
  quillInstances: { en: null, rus: null, mng: null },

  initialize() {
    console.log("AdminUI initialize START");
    if (typeof Quill === "undefined") {
      console.error("Quill.js not loaded.");
      this.displayMessage(
        this.elements.articleFormMessage,
        "Text editor failed to load.",
        true,
      );
    } else {
      this.initQuillEditor();
    }
    this.setupEventListeners();
    console.log("Fetching CSRF token in initialize...");
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
    const initInstance = (lang) => {
      const container = this.elements[`editorContainer_${lang}`],
        input = this.elements[`articleContent_${lang}`];
      if (container && input) {
        try {
          this.quillInstances[lang] = new Quill(container, {
            theme: "snow",
            modules: { toolbar: toolbarOptions },
            placeholder: `Write ${lang.toUpperCase()} content...`,
          });
          this.quillInstances[lang].on("text-change", (d, o, s) => {
            if (s === "user" && this.quillInstances[lang])
              input.value = this.quillInstances[lang].root.innerHTML;
          });
        } catch (e) {
          console.error(`Quill init error (${lang}):`, e);
          this.displayMessage(
            this.elements.articleFormMessage,
            `Editor (${lang}) load fail.`,
            true,
          );
        }
      } else console.warn(`Quill elements missing for ${lang}`);
    };
    ["en", "rus", "mng"].forEach(initInstance);
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
    this.elements.articlesContainer?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      if (btn.classList.contains("edit-article"))
        this.loadArticleForEditing(id);
      else if (btn.classList.contains("delete-article"))
        this.handleDeleteArticle(id);
      else if (btn.classList.contains("suggest-edit-article"))
        this.handleSuggestEditClick(id);
    });
    this.elements.suggestionsListContainer?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.suggestionId;
      if (!id) return;
      if (btn.classList.contains("approve-suggestion"))
        this.handleApproveSuggestion(id, btn);
      else if (btn.classList.contains("reject-suggestion"))
        this.handleRejectSuggestion(id, btn);
      else if (btn.classList.contains("view-suggestion"))
        this.showSuggestionDetails(id);
    });
    this.elements.modalCloseButton?.addEventListener("click", () =>
      this.closeSuggestionModal(),
    );
    this.elements.suggestionModal?.addEventListener("click", (e) => {
      if (e.target === this.elements.suggestionModal)
        this.closeSuggestionModal();
    });
    // Add listener for moderator list actions
    this.elements.moderatorsListContainer?.addEventListener(
      "click",
      this.handleModeratorActionClick.bind(this),
    );
  },

  handleManageModeratorsClick() {
    if (this.currentUserRole !== "admin") return;
    const section = this.elements.moderatorsSection;
    if (!section) return;
    section.classList.toggle("hidden");
    if (!section.classList.contains("hidden")) {
      this.loadModerators();
      this.loadSuggestions();
    }
  },

  async updateUI() {
    console.log("Checking login status...");
    const loggedIn = AuthService.isLoggedIn();
    this.currentUserRole = null;
    this.elements.loginPanel?.classList.toggle("hidden", loggedIn);
    this.elements.adminPanel?.classList.toggle("hidden", !loggedIn);

    if (loggedIn) {
      console.log("Attempting ApiService.getMe()...");
      try {
        const userInfo = await ApiService.getMe();
        this.currentUserRole = userInfo?.role;
        if (
          !this.currentUserRole ||
          !["admin", "moderator"].includes(this.currentUserRole)
        )
          throw new Error("Invalid user role");
        console.log("[Admin UI] User Role:", this.currentUserRole);
        this.renderUIForRole();
        this.loadArticles();
        if (this.currentUserRole === "moderator") this.loadMySuggestions();
      } catch (error) {
        console.error("[Admin UI] Error updating UI:", error);
        AuthService.clearTokens();
        window.location.reload(); // Force reload on error
      }
    } else {
      this.clearAdminContent();
    }
  },

  renderUIForRole() {
    const isAdmin = this.currentUserRole === "admin";
    const isModerator = this.currentUserRole === "moderator";
    this.elements.manageModeratorsButtonWrapper?.classList.toggle(
      "hidden",
      !isAdmin,
    );
    this.elements.moderatorsSection?.classList.add("hidden"); // Always hide admin section initially
    this.elements.moderatorSuggestionsSection?.classList.toggle(
      "hidden",
      !isModerator,
    );
    this.elements.newArticleButton?.classList.toggle(
      "hidden",
      !isAdmin && !isModerator,
    );

    if (this.elements.newArticleButton) {
      this.elements.newArticleButton.textContent = isAdmin
        ? "Create New Article"
        : "Suggest New Article";
    }
    if (this.elements.articleSubmit) {
      this.elements.articleSubmit.textContent = isAdmin
        ? this.elements.articleId.value
          ? "Update Article"
          : "Create Article"
        : "Submit Suggestion";
    }
    if (this.elements.formHeading) {
      this.elements.formHeading.textContent = isAdmin
        ? this.elements.articleId.value
          ? "Edit Article"
          : "Create New Article"
        : this.elements.articleId.value
          ? "Suggest Edits For Article"
          : "Suggest New Article";
    }
    // Refresh article rendering in case buttons need to change
    if (
      this.elements.articlesContainer?.innerHTML &&
      !this.elements.articlesContainer.innerHTML.includes("Loading")
    ) {
      this.loadArticles();
    }
  },

  clearAdminContent() {
    this.elements.articlesContainer &&
      (this.elements.articlesContainer.innerHTML = "");
    this.elements.articleFormContainer?.classList.add("hidden");
    this.elements.moderatorsSection?.classList.add("hidden");
    this.elements.moderatorsListContainer &&
      (this.elements.moderatorsListContainer.innerHTML = "");
    this.elements.suggestionsListContainer &&
      (this.elements.suggestionsListContainer.innerHTML = "");
    this.elements.moderatorSuggestionsSection &&
      (this.elements.moderatorSuggestionsSection.innerHTML = "");
    this.closeSuggestionModal();
    this.resetForm();
  },

  async loadArticles() {
    console.log("Attempting ApiService.getArticles()...");
    const container = this.elements.articlesContainer;
    if (!container) return;
    container.innerHTML =
      '<p class="text-center p-4 col-span-full">Loading articles...</p>';
    try {
      const articles = await ApiService.getArticles();
      if (!Array.isArray(articles)) throw new Error("Invalid list format");
      this.renderArticles(articles);
    } catch (e) {
      container.innerHTML = `<p class="text-red-500 text-center p-4 col-span-full">Load failed: ${e.message}</p>`;
    }
  },

  renderArticles(articles) {
    const container = this.elements.articlesContainer;
    if (!container) return;
    if (!articles || articles.length === 0) {
      container.innerHTML =
        "<p class='text-center p-4 col-span-full'>No articles found.</p>";
      return;
    }
    container.innerHTML = articles
      .map((a) => {
        if (!a?.id) return "";
        const title = a.title_en || a.title || "Untitled";
        const buttons =
          this.currentUserRole === "admin"
            ? `<button class="edit-article btn btn-blue text-sm py-1 px-3" data-id="${a.id}">Edit</button> <button class="delete-article btn btn-red text-sm py-1 px-3" data-id="${a.id}">Delete</button>`
            : `<button class="suggest-edit-article btn btn-blue text-sm py-1 px-3" data-id="${a.id}">Suggest Edit</button>`;
        return `<div class="article-card border dark:border-gray-600 rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-700 flex flex-col"> ${a.imageUrl ? `<img src="${a.imageUrl}" alt="${title}" class="w-full h-48 object-cover">` : '<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300">No Image</div>'} <div class="p-4 flex flex-col flex-grow"> <h3 class="text-lg font-bold mb-1 dark:text-white flex-grow">${title}</h3> <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Cat: ${a.category || "?"}</p> <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">By: ${a.author || "?"}</p> <p class="text-sm font-medium ${a.status === "published" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"} mb-2 capitalize">Status: ${a.status || "?"}</p> <div class="mt-auto pt-2 flex space-x-2">${buttons}</div> </div> </div>`;
      })
      .join("");
  },

  async loadModerators() {
    const container = this.elements.moderatorsListContainer;
    if (this.currentUserRole !== "admin" || !container) return;
    container.innerHTML = '<p class="text-center p-4">Loading...</p>';
    try {
      const mods = await ApiService.getUsers({ role: "moderator" });
      this.renderModerators(mods);
    } catch (e) {
      container.innerHTML = `<p class="text-red-500 text-center p-4">Failed: ${e.message}</p>`;
    }
  },

  renderModerators(moderators) {
    const container = this.elements.moderatorsListContainer;
    if (this.currentUserRole !== "admin" || !container) return;
    if (!Array.isArray(moderators)) {
      container.innerHTML =
        '<p class="text-red-500 text-center p-4">Error: Invalid data.</p>';
      return;
    }
    if (moderators.length === 0) {
      container.innerHTML =
        '<p class="text-center p-4 text-gray-500 dark:text-gray-400">No moderators found.</p>';
      return;
    }
    container.innerHTML = `<ul class="space-y-2"> ${moderators
      .map(
        (mod) => `
        <li class="flex flex-wrap justify-between items-center gap-2 p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-800">
            <span class="flex-grow mr-2">
                ${mod.username} (<span class="text-xs text-gray-500 dark:text-gray-400">${mod.email}</span>)
                ${mod.needsPasswordChange ? '<span class="text-xs text-orange-500 ml-2 font-semibold">(Needs PW Reset)</span>' : ""}
            </span>
            <button class="delete-moderator btn btn-red text-xs py-1 px-2 flex-shrink-0" data-user-id="${mod.id}" data-username="${mod.username}" title="Delete moderator ${mod.username}"> Delete </button>
        </li>`,
      )
      .join("")} </ul>`;
    // Listener is attached via delegation in setupEventListeners
  },

  // +++ Handler for Moderator Actions (Delete) +++
  async handleModeratorActionClick(event) {
    const button = event.target.closest("button.delete-moderator");
    if (!button || button.disabled) return; // Ignore non-delete clicks or disabled buttons

    const userId = button.dataset.userId;
    const username = button.dataset.username;
    const userIdNum = parseInt(userId, 10);

    if (!userIdNum || !username) {
      alert("Could not delete: button data missing.");
      return;
    }
    if (!confirm(`Delete moderator "${username}" (ID: ${userIdNum})?`)) return;

    button.disabled = true;
    button.textContent = "Deleting...";
    try {
      await ApiService.deleteUser(userIdNum);
      this.loadModerators(); // Refresh list
    } catch (error) {
      alert(`Error deleting moderator: ${error.message}`);
      button.disabled = false;
      button.textContent = "Delete"; // Reset button on error
    }
  },
  // +++++++++++++++++++++++++++++++++++++++++++++++++

  async loadSuggestions() {
    // Admin loads pending
    const container = this.elements.suggestionsListContainer;
    if (this.currentUserRole !== "admin" || !container) return;
    container.innerHTML =
      '<p class="text-center p-4">Loading suggestions...</p>';
    try {
      const suggestions = await ApiService.getSuggestions("pending");
      this.renderSuggestions(suggestions);
    } catch (e) {
      container.innerHTML = `<p class="text-red-500 text-center p-4">Failed: ${e.message}</p>`;
    }
  },

  renderSuggestions(suggestions) {
    // Admin renders pending list
    const container = this.elements.suggestionsListContainer;
    if (this.currentUserRole !== "admin" || !container) return;
    if (!Array.isArray(suggestions)) {
      container.innerHTML =
        '<p class="text-red-500 text-center p-4">Error: Invalid data.</p>';
      return;
    }
    if (suggestions.length === 0) {
      container.innerHTML =
        '<p class="text-center p-4 text-gray-500 dark:text-gray-400">No pending suggestions.</p>';
      return;
    }
    container.innerHTML = suggestions
      .map((s) => {
        const isNew = !s.articleId;
        const title = isNew
          ? (s.proposedTitle || "(New Article)") +
            ' <span class="text-xs font-normal text-blue-500 dark:text-blue-400">(New)</span>'
          : s.article?.title_en || `Article ID: ${s.articleId}`;
        const modName = s.moderator?.username || `User ${s.moderatorId}`;
        const date = s.createdAt
          ? new Date(s.createdAt).toLocaleDateString()
          : "?";
        return `<div class="suggestion-item p-3 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 shadow-sm"> <div class="flex flex-wrap justify-between items-center gap-2 mb-2"> <div> <span class="block font-semibold dark:text-white">Article: ${title}</span> <span class="block text-sm text-gray-600 dark:text-gray-400">By: ${modName} on ${date}</span> </div> <div class="flex justify-end items-center gap-2 mt-2 sm:mt-0 suggestion-actions flex-shrink-0"> <span class="text-sm text-green-600 dark:text-green-400 hidden success-message">Approved!</span> <span class="text-sm text-red-600 dark:text-red-400 hidden reject-message">Rejected!</span> <span class="text-sm text-red-600 dark:text-red-400 hidden error-message"></span> <button class="view-suggestion btn btn-gray text-xs py-1 px-2" data-suggestion-id="${s.id}">Details</button> <button class="reject-suggestion btn btn-red text-xs py-1 px-2" data-suggestion-id="${s.id}">Reject</button> <button class="approve-suggestion btn btn-green text-xs py-1 px-2" data-suggestion-id="${s.id}">Approve</button> </div> </div> </div>`;
      })
      .join("");
  },

  async showSuggestionDetails(suggestionId) {
    // Admin views detail modal
    const modal = this.elements.suggestionModal,
      body = this.elements.modalBody;
    if (!modal || !body) return;
    body.innerHTML = '<p class="p-4 text-center">Loading...</p>';
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    try {
      const s = await ApiService.getSuggestionDetails(suggestionId);
      if (!s?.proposedData) throw new Error("Data missing.");
      const p = s.proposedData,
        isNew = !s.articleId;
      const title = isNew
        ? p.title_en || "(New)"
        : s.article?.title_en || `ID: ${s.articleId}`;
      const mod = s.moderator?.username || `User ${s.moderatorId}`;
      if (this.elements.modalTitle)
        this.elements.modalTitle.textContent = `Suggestion for: ${title} ${isNew ? "(New)" : ""}`;
      body.innerHTML = `<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">By: ${mod}</p> <div class="space-y-4"> <h4 class="font-bold text-lg border-b dark:border-gray-600 pb-1 mb-2">Changes:</h4> ${this.renderProposedField("Title EN", p.title_en)} ${this.renderProposedField("Content EN", p.content_en, 1)} ${this.renderProposedField("Excerpt EN", p.excerpt_en)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Title RU", p.title_rus)} ${this.renderProposedField("Content RU", p.content_rus, 1)} ${this.renderProposedField("Excerpt RU", p.excerpt_rus)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Title MN", p.title_mng)} ${this.renderProposedField("Content MN", p.content_mng, 1)} ${this.renderProposedField("Excerpt MN", p.excerpt_mng)} <hr class="dark:border-gray-600 my-3"> ${this.renderProposedField("Category", p.category)} ${this.renderProposedField("Author", p.author)} ${this.renderProposedField("Image URL", p.imageUrl)} </div>`;
    } catch (e) {
      body.innerHTML = `<p class="p-4 text-center text-red-500">Error: ${e.message}</p>`;
    }
  },

  renderProposedField(label, value, isHtml = false) {
    const display = value
      ? value
      : '<span class="text-gray-400 italic">(empty)</span>';
    return `<div class="mb-2"> <strong class="block text-sm font-medium text-gray-700 dark:text-gray-300">${label}:</strong> ${isHtml ? `<div class="mt-1 text-sm text-gray-900 dark:text-gray-100 prose prose-sm dark:prose-invert max-w-none border dark:border-gray-600 p-2 rounded">${display}</div>` : `<span class="mt-1 text-sm text-gray-900 dark:text-gray-100">${display}</span>`} </div>`;
  },

  closeSuggestionModal() {
    const modal = this.elements.suggestionModal;
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    if (this.elements.modalBody) this.elements.modalBody.innerHTML = "";
    if (this.elements.modalTitle)
      this.elements.modalTitle.textContent = "Details";
  },

  async loadMySuggestions() {
    // Moderator loads own suggestions
    const container = this.elements.moderatorSuggestionsSection;
    if (!container) return;
    container.innerHTML =
      '<p class="text-center p-4">Loading suggestions...</p>';
    try {
      const suggestions = await ApiService.getMySuggestions();
      this.renderMySuggestions(suggestions);
    } catch (e) {
      container.innerHTML = `<p class="text-red-500 text-center p-4">Failed: ${e.message}</p>`;
    }
  },

  renderMySuggestions(suggestions) {
    // Moderator renders own list
    const container = this.elements.moderatorSuggestionsSection;
    if (!container) return;
    if (!Array.isArray(suggestions)) {
      container.innerHTML =
        '<p class="text-red-500 text-center p-4">Error: Invalid data.</p>';
      return;
    }
    if (suggestions.length === 0) {
      container.innerHTML =
        '<p class="text-center p-4 text-gray-500 dark:text-gray-400">No suggestions submitted yet.</p>';
      return;
    }
    const fmtDate = (d) =>
      d
        ? new Date(d).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "N/A";
    const statusCls = (s) =>
      ({
        approved:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        pending:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      })[s] || "";
    const esc = (s) =>
      s ? s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">") : "";
    container.innerHTML = `<h2 class="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600 dark:text-white">My Submitted Suggestions</h2> <div class="space-y-4"> ${suggestions
      .map((s) => {
        const isNew = !s.articleId;
        const title = esc(
          isNew
            ? s.proposedTitle || "(New)"
            : s.article?.title_en || `ID: ${s.articleId}`,
        );
        const dateSub = fmtDate(s.createdAt),
          dateUpd = fmtDate(s.updatedAt || s.createdAt);
        return `<div class="p-4 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 shadow-sm"> <div class="flex flex-wrap justify-between items-start gap-2 mb-2"> <div> <span class="block font-semibold dark:text-white text-lg">${title} ${isNew ? '<span class="text-xs font-normal text-blue-500 dark:text-blue-400">(New)</span>' : ""}</span> <span class="block text-sm text-gray-500 dark:text-gray-400 mt-1">Submitted: ${dateSub} | Updated: ${dateUpd}</span> </div> <span class="text-xs font-medium px-2.5 py-0.5 rounded ${statusCls(s.status)} capitalize self-center flex-shrink-0">${esc(s.status)}</span> </div> ${s.status === "rejected" && s.adminComments ? `<div class="mt-2 p-3 bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 rounded"><p class="text-sm font-semibold text-red-700 dark:text-red-300">Feedback:</p><p class="text-sm text-red-600 dark:text-red-200 italic">${esc(s.adminComments)}</p></div>` : ""} </div>`;
      })
      .join("")} </div>`;
  },

  async loadArticleForEditing(articleId) {
    const container = this.elements.articleFormContainer,
      form = this.elements.articleForm;
    if (!container || !form) return;
    this.displayMessage(this.elements.articleFormMessage, "Loading...", false);
    this.elements.articleSubmit.disabled = true;
    try {
      const a = await ApiService.getArticle(articleId);
      if (!a) throw new Error("Not found");
      form.querySelector("#article-id").value = a.id;
      form.querySelector("#article-category").value = a.category || "";
      form.querySelector("#article-author").value = a.author || "";
      form.querySelector("#article-image").value = a.imageUrl || "";
      ["en", "rus", "mng"].forEach((l) => {
        form.querySelector(`#article-title-${l}`).value = a[`title_${l}`] || "";
        form.querySelector(`#article-excerpt-${l}`).value =
          a[`excerpt_${l}`] || "";
        const content = a[`content_${l}`] || "",
          quill = this.quillInstances[l],
          input = form.querySelector(`#article-content-${l}`);
        if (quill) quill.root.innerHTML = content;
        if (input) input.value = content;
      });
      this.renderUIForRole();
      this.displayMessage(this.elements.articleFormMessage, "", false);
      container.classList.remove("hidden");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      this.displayMessage(
        this.elements.articleFormMessage,
        `Error: ${e.message}`,
        true,
      );
    } finally {
      this.elements.articleSubmit.disabled = false;
    }
  },

  resetForm() {
    const form = this.elements.articleForm;
    if (!form) return;
    form.reset();
    ["en", "rus", "mng"].forEach((l) => {
      const q = this.quillInstances[l],
        i = form.querySelector(`#article-content-${l}`);
      if (q) q.setText("");
      if (i) i.value = "";
    });
    form.querySelector("#article-id").value = "";
    this.renderUIForRole();
    this.displayMessage(this.elements.articleFormMessage, "", false);
  },

  displayMessage(el, msg, isErr = false) {
    if (!el) return;
    el.textContent = msg;
    el.className = `mt-4 text-center text-sm ${isErr ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
    el.classList.toggle("hidden", !msg);
  },

  async handleLogin(e) {
    e.preventDefault();
    const form = this.elements.loginForm,
      user = form.querySelector("#username")?.value.trim(),
      pass = form.querySelector("#password")?.value,
      msgEl = this.elements.loginMessage,
      btn = form.querySelector("button");
    if (!user || !pass)
      return this.displayMessage(msgEl, "Username/password required.", 1);
    this.displayMessage(msgEl, "Logging in...", 0);
    if (btn) btn.disabled = 1;
    try {
      const data = await ApiService.login(user, pass);
      if (!data?.accessToken || !data?.refreshToken)
        throw new Error("Login invalid response.");
      AuthService.setTokens(data.accessToken, data.refreshToken);
      this.displayMessage(msgEl, "Success!", 0);
      if (form.querySelector("#password"))
        form.querySelector("#password").value = "";
      await this.updateUI();
    } catch (e) {
      console.error("Login Fail:", e);
      let msg = e.message || "Unknown error",
        needsChange = 0,
        chgToken = null;
      if (e.data?.needsPasswordChange && e.data?.changePasswordToken) {
        msg = e.data.message || msg;
        needsChange = 1;
        chgToken = e.data.changePasswordToken;
      }
      if (needsChange && chgToken) {
        sessionStorage.setItem("changePasswordToken", chgToken);
        sessionStorage.setItem("changeUsername", user);
        this.displayMessage(msgEl, msg, 1);
        alert(msg + " Redirecting...");
        setTimeout(
          () => (window.location.href = "/change-initial-password.html"),
          100,
        );
      } else {
        this.displayMessage(msgEl, `Login failed: ${msg}`, 1);
        if (btn) btn.disabled = 0;
      }
    }
  },
  async handleArticleSubmit(e) {
    e.preventDefault();
    const form = this.elements.articleForm;
    if (!form) return;
    const submitTxt = this.elements.articleSubmit?.textContent || "",
      isSugg = submitTxt.includes("Suggest"),
      id = form.querySelector("#article-id").value,
      msgEl = this.elements.articleFormMessage,
      btn = this.elements.articleSubmit;
    if (
      (isSugg && this.currentUserRole !== "moderator") ||
      (!isSugg && this.currentUserRole !== "admin")
    )
      return alert("Permission denied.");
    ["en", "rus", "mng"].forEach((l) => {
      const q = this.quillInstances[l],
        i = form.querySelector(`#article-content-${l}`);
      if (q && i) i.value = q.root.innerHTML;
    });
    const data = {
      title_en: form.querySelector("#article-title-en").value.trim(),
      content_en: form.querySelector("#article-content-en").value,
      excerpt_en:
        form.querySelector("#article-excerpt-en").value.trim() || null,
      title_rus: form.querySelector("#article-title-rus").value.trim() || null,
      content_rus: form.querySelector("#article-content-rus").value || null,
      excerpt_rus:
        form.querySelector("#article-excerpt-rus").value.trim() || null,
      title_mng: form.querySelector("#article-title-mng").value.trim() || null,
      content_mng: form.querySelector("#article-content-mng").value || null,
      excerpt_mng:
        form.querySelector("#article-excerpt-mng").value.trim() || null,
      category: form.querySelector("#article-category").value,
      author: form.querySelector("#article-author").value.trim(),
      imageUrl: form.querySelector("#article-image").value.trim() || null,
    };
    if (
      !data.title_en ||
      !data.content_en ||
      data.content_en === "<p><br></p>" ||
      !data.category ||
      !data.author
    )
      return this.displayMessage(
        msgEl,
        "Required: Eng Title, Eng Content, Category, Author.",
        1,
      );
    let verb = isSugg
      ? id
        ? "Suggesting Edit"
        : "Suggesting New"
      : id
        ? "Updating"
        : "Creating";
    this.displayMessage(msgEl, `${verb}...`, 0);
    if (btn) btn.disabled = 1;
    try {
      let msg = "";
      if (isSugg) {
        const r = id
          ? await ApiService.suggestArticleEdit(id, data)
          : await ApiService.suggestNewArticle(data);
        msg = r.message || "Suggestion submitted.";
        if (this.currentUserRole === "moderator")
          setTimeout(() => this.loadMySuggestions(), 1000);
      } else {
        const r = id
          ? await ApiService.updateArticle(id, data)
          : await ApiService.createArticle(data);
        msg = id ? "Article updated!" : "Article created!";
        await this.loadArticles();
      }
      this.displayMessage(msgEl, msg, 0);
      this.resetForm();
      this.elements.articleFormContainer?.classList.add("hidden");
      setTimeout(() => {
        if (msgEl?.textContent.includes(msg)) this.displayMessage(msgEl, "", 0);
      }, 5000);
    } catch (e) {
      console.error(`Submit Error:`, e);
      let msg = `Error: ${e.message}`;
      if (e.data?.errors?.length)
        msg = `Error: ${e.data.errors.map((err) => `${err.param || err.field || "Input"}: ${err.msg || err.message}`).join(", ")}`;
      this.displayMessage(msgEl, msg, 1);
    } finally {
      if (btn) btn.disabled = 0;
    }
  },
  async handleDeleteArticle(id) {
    if (this.currentUserRole !== "admin" || !id) return;
    if (!confirm(`Delete article ID ${id}?`)) return;
    const btn = this.elements.articlesContainer?.querySelector(
      `.delete-article[data-id="${id}"]`,
    );
    if (btn) btn.disabled = 1;
    try {
      await ApiService.deleteArticle(id);
      this.loadArticles();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
      if (btn) btn.disabled = 0;
    }
  },
  handleNewArticleClick() {
    const c = this.elements.articleFormContainer;
    if (!c) return;
    this.resetForm();
    this.renderUIForRole();
    c.classList.remove("hidden");
    this.elements.articleForm?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  },
  handleCancelClick() {
    const c = this.elements.articleFormContainer;
    if (!c) return;
    this.resetForm();
    c.classList.add("hidden");
  },
  handleLogout() {
    AuthService.clearTokens();
    this.updateUI();
  },
  handleSuggestEditClick(id) {
    if (this.currentUserRole !== "moderator" || !id) return;
    this.loadArticleForEditing(id);
  },
  async handleCreateModeratorSubmit(e) {
    e.preventDefault();
    const form = this.elements.createModeratorForm;
    if (this.currentUserRole !== "admin" || !form) return;
    const user = form.querySelector("#mod-username")?.value.trim(),
      email = form.querySelector("#mod-email")?.value.trim(),
      msgEl = this.elements.createModeratorMessage,
      btn = form.querySelector("button");
    if (!user || !email)
      return this.displayMessage(msgEl, "Username/Email required.", 1);
    this.displayMessage(msgEl, "Creating...", 0);
    if (btn) btn.disabled = 1;
    try {
      const r = await ApiService.createUser({ username: user, email: email });
      this.displayMessage(
        msgEl,
        `Moderator '${user}' created. Temp PW: ${r.temporaryPassword}`,
        0,
      );
      form.reset();
      this.loadModerators();
      setTimeout(() => {
        if (msgEl?.textContent.includes("created"))
          this.displayMessage(msgEl, "", 0);
      }, 15000);
    } catch (e) {
      let msg = `Failed create: ${e.message}`;
      if (e.data?.errors?.length)
        msg = `Error: ${e.data.errors.map((err) => `${err.param || err.field || "Input"}: ${err.msg || err.message}`).join(", ")}`;
      this.displayMessage(msgEl, msg, 1);
    } finally {
      if (btn) btn.disabled = 0;
    }
  },
  async handleApproveSuggestion(id, btn) {
    if (this.currentUserRole !== "admin") return;
    const acts = btn.closest(".suggestion-actions"),
      errEl = acts?.querySelector(".error-message"),
      sucEl = acts?.querySelector(".success-message"),
      rejBtn = acts?.querySelector(".reject-suggestion"),
      viewBtn = acts?.querySelector(".view-suggestion");
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }
    if (sucEl) sucEl.classList.add("hidden");
    btn.disabled = 1;
    if (rejBtn) rejBtn.disabled = 1;
    if (viewBtn) viewBtn.disabled = 1;
    try {
      await ApiService.approveSuggestion(id);
      if (sucEl) sucEl.classList.remove("hidden");
      btn
        .closest(".suggestion-item")
        ?.classList.add("opacity-50", "bg-green-50", "dark:bg-green-900/30");
      setTimeout(() => this.loadSuggestions(), 2000);
      setTimeout(() => this.loadArticles(), 2100);
    } catch (e) {
      if (errEl) {
        errEl.textContent = `Error: ${e.message}`;
        errEl.classList.remove("hidden");
      } else alert(`Error: ${e.message}`);
      btn.disabled = 0;
      if (rejBtn) rejBtn.disabled = 0;
      if (viewBtn) viewBtn.disabled = 0;
    }
  },
  async handleRejectSuggestion(id, btn) {
    if (this.currentUserRole !== "admin") return;
    const reason = prompt("Optional: Reason for rejection:");
    const acts = btn.closest(".suggestion-actions"),
      errEl = acts?.querySelector(".error-message"),
      rejMsgEl = acts?.querySelector(".reject-message"),
      appBtn = acts?.querySelector(".approve-suggestion"),
      viewBtn = acts?.querySelector(".view-suggestion");
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }
    if (rejMsgEl) rejMsgEl.classList.add("hidden");
    btn.disabled = 1;
    if (appBtn) appBtn.disabled = 1;
    if (viewBtn) viewBtn.disabled = 1;
    try {
      await ApiService.rejectSuggestion(id, reason);
      if (rejMsgEl) rejMsgEl.classList.remove("hidden");
      btn
        .closest(".suggestion-item")
        ?.classList.add("opacity-50", "bg-red-50", "dark:bg-red-900/30");
      setTimeout(() => this.loadSuggestions(), 2000);
    } catch (e) {
      if (errEl) {
        errEl.textContent = `Error: ${e.message}`;
        errEl.classList.remove("hidden");
      } else alert(`Error: ${e.message}`);
      btn.disabled = 0;
      if (appBtn) appBtn.disabled = 0;
      if (viewBtn) viewBtn.disabled = 0;
    }
  },
}; // End of AdminUI object

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("Admin page DOM fully loaded and parsed");
  AdminUI.initialize();
});
