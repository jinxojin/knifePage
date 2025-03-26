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
      // Use credentials: 'include' for the CSRF token fetch as well,
      // in case the server route requires credentials in the future.
      const response = await fetch(`${this.baseUrl}/csrf-token`, {
        credentials: "include",
      });
      if (!response.ok) {
        // Provide more specific error for rate limiting
        if (response.status === 429) {
          throw new Error(
            `Failed to fetch CSRF token: ${response.status} Too Many Requests. Please wait a moment and try again.`,
          );
        }
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      const data = await response.json();
      this.csrfToken = data.csrfToken; // Store token
      console.log("CSRF Token fetched:", this.csrfToken); // Log token fetch
      return this.csrfToken;
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      throw error; // Re-throw to be caught by caller
    }
  },

  /**
   * Makes a generic API request, handling CSRF token and authorization.
   * Automatically retries once if a CSRF token error occurs.
   * @param {string} url - The full URL for the API endpoint.
   * @param {string} [method='GET'] - The HTTP method (GET, POST, PUT, DELETE, etc.).
   * @param {object|null} [data=null] - The data payload for POST/PUT requests.
   * @returns {Promise<object|null>} The parsed JSON response, or null for non-JSON responses.
   * @throws {Error} If the request fails or returns a non-OK status (after retry if applicable).
   */
  async makeRequest(url, method = "GET", data = null, isRetry = false) {
    // Added isRetry flag
    // Fetch CSRF token if needed for state-changing methods and not already present
    if (
      !this.csrfToken &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(method)
    ) {
      console.log("Fetching CSRF token before making request...");
      await this.fetchCsrfToken(); // This might throw if rate limited
    }

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      // Only add Authorization header if an access token exists
    };
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add CSRF token header if necessary
    if (this.csrfToken && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      headers["x-csrf-token"] = this.csrfToken;
      console.log(
        `Including CSRF token in ${method} request header for ${url}`,
      );
    } else {
      console.log(
        `CSRF token NOT included or needed for ${method} request to ${url}`,
      );
    }

    // Prepare fetch options
    const options = {
      method,
      headers,
      // *** THIS IS THE CRUCIAL FIX: ***
      credentials: "include", // Tell the browser to send cookies and authorization headers
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    console.log(`Making ${method} request to ${url} with options:`, {
      headers: options.headers,
      body: options.body ? "..." : undefined,
      credentials: options.credentials,
    }); // Log credentials setting

    try {
      const response = await fetch(url, options);

      console.log(`Response status for ${method} ${url}: ${response.status}`);

      // --- CSRF Token Retry Logic ---
      // Check specifically for 403 Forbidden AND the specific error message
      // Only retry if this is not already a retry attempt to prevent infinite loops
      if (response.status === 403 && !isRetry) {
        try {
          const errorJson = await response.clone().json(); // Clone to read body without consuming
          if (
            errorJson.message &&
            errorJson.message.toLowerCase() === "invalid csrf token"
          ) {
            console.warn(
              "CSRF token invalid, invalidating stored token and retrying request ONCE...",
            );
            this.csrfToken = null; // Invalidate our current token
            // Retry the request ONCE, passing true for isRetry.
            // fetchCsrfToken will be called again at the start of the *next* makeRequest call.
            return this.makeRequest(url, method, data, true);
          }
        } catch (e) {
          // If parsing the error response fails, log it but proceed to general error handling
          console.error(
            "Could not parse potential CSRF error response body:",
            e,
          );
        }
      }
      // --- End CSRF Token Retry Logic ---

      if (!response.ok) {
        // Attempt to parse JSON error, provide fallback message
        const errorData = await response.json().catch(() => ({
          message: `Request failed with status ${response.status} ${response.statusText}`,
        }));
        console.error(`Request failed: ${response.status}`, errorData);
        // Throw an error with the message from the server or a generic one
        throw new Error(
          errorData.message ||
            `Request failed with status ${response.status} ${response.statusText}`,
        );
      }

      // Handle potential non-JSON responses (e.g., DELETE might return 204 No Content)
      const contentType = response.headers.get("content-type");
      if (
        response.status === 204 ||
        !contentType ||
        !contentType.includes("application/json")
      ) {
        console.log(
          `Received non-JSON or No Content response for ${method} ${url} (Status: ${response.status})`,
        );
        return null; // Or handle as appropriate (e.g., return true for successful DELETE)
      }

      const responseData = await response.json();
      console.log(`Successfully received data for ${method} ${url}.`); // Don't log potentially sensitive data here
      return responseData;
    } catch (networkError) {
      console.error(
        `Network error during ${method} request to ${url}:`,
        networkError,
      );
      // Add more specific handling for fetchCsrfToken errors if needed
      if (networkError.message.includes("Failed to fetch CSRF token")) {
        // Potentially display a user-friendly message about connectivity or rate limiting
      }
      throw networkError; // Re-throw network errors
    }
  },

  /**
   * Logs in the admin user.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>} The login response data (tokens).
   * @throws {Error} If login fails.
   */
  async login(username, password) {
    console.log("Login attempt using makeRequest");
    try {
      // Use the makeRequest helper
      const data = await this.makeRequest(
        `${this.baseUrl}/admin/login`,
        "POST",
        { username, password }, // Pass data as the third argument
      );
      // Success logging happens inside makeRequest if successful
      return data;
    } catch (error) {
      console.error("Login Error (caught in login method):", error);
      // Re-throw the error so the UI handler can catch it
      throw error;
    }
  },

  /**
   * Refreshes the access token using the refresh token.
   * @returns {Promise<string|null>} The new access token, or null if refresh fails or no token exists.
   * @throws {Error} If the refresh request fails.
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      console.log("No refresh token found.");
      return null; // No refresh token
    }

    console.log("Attempting to refresh token...");
    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/admin/refresh`,
        "POST", // Refresh should be POST
        { refreshToken },
      );
      console.log("Token refreshed successfully.");
      return data.accessToken;
    } catch (error) {
      console.error("Refresh token failed:", error);
      AuthService.clearTokens(); // Clear tokens on refresh failure
      // Don't throw generic "Refresh token failed" here, let the specific error from makeRequest propagate
      // throw new Error("Refresh token failed");
      throw error; // Re-throw the error from makeRequest
    }
  },

  /**
   * Fetches all articles (requires authentication).
   * Handles token refresh automatically if needed.
   * @returns {Promise<Array<object>>} Array of article objects.
   * @throws {Error} If fetching fails even after potential token refresh.
   */
  async getArticles() {
    try {
      // Initial attempt
      return await this.makeRequest(`${this.baseUrl}/articles`);
    } catch (error) {
      // Check for potential authorization errors (401 Unauthorized, 403 Forbidden)
      // Use includes check on the error message which now contains status text from makeRequest
      if (
        error.message.includes("401") ||
        error.message.includes("Forbidden") ||
        error.message.includes("403")
      ) {
        // Check for 403 as well
        console.log(
          "Authorization error fetching articles, attempting token refresh...",
        );
        try {
          const newAccessToken = await this.refreshToken(); // Attempt to refresh
          if (newAccessToken) {
            localStorage.setItem("accessToken", newAccessToken); // Store the new token
            console.log("Retrying getArticles with new token.");
            // Retry the original request ONCE with the new token
            return await this.makeRequest(`${this.baseUrl}/articles`);
          } else {
            // Refresh failed or no refresh token available
            console.log(
              "Refresh token failed or not available. Clearing session.",
            );
            AuthService.clearTokens();
            window.location.href = "/admin.html"; // Redirect to login
            // Throw a user-friendly error after redirect attempt
            throw new Error("Session expired. Please log in again.");
          }
        } catch (refreshError) {
          // Error occurred *during* the refresh attempt
          console.error("Error during token refresh:", refreshError);
          AuthService.clearTokens();
          window.location.href = "/admin.html"; // Redirect on refresh error
          throw new Error("Session expired. Please log in again.");
        }
      } else {
        // Not an auth error, re-throw the original error
        console.error("Non-authorization error fetching articles:", error);
        throw error;
      }
    }
  },

  /**
   * Fetches a single article by ID (requires authentication).
   * Includes basic token refresh logic similar to getArticles.
   * @param {string|number} id - The ID of the article.
   * @returns {Promise<object>} The article object.
   * @throws {Error} If fetching fails.
   */
  async getArticle(id) {
    try {
      return await this.makeRequest(`${this.baseUrl}/articles/${id}`);
    } catch (error) {
      if (
        error.message.includes("401") ||
        error.message.includes("Forbidden") ||
        error.message.includes("403")
      ) {
        console.log(
          `Authorization error fetching article ${id}, attempting token refresh...`,
        );
        try {
          const newAccessToken = await this.refreshToken();
          if (newAccessToken) {
            localStorage.setItem("accessToken", newAccessToken);
            console.log(`Retrying getArticle ${id} with new token.`);
            return await this.makeRequest(`${this.baseUrl}/articles/${id}`);
          } else {
            console.log("Refresh token failed or not available.");
            AuthService.clearTokens();
            window.location.href = "/admin.html";
            throw new Error("Session expired. Please log in again.");
          }
        } catch (refreshError) {
          console.error("Error during token refresh:", refreshError);
          AuthService.clearTokens();
          window.location.href = "/admin.html";
          throw new Error("Session expired. Please log in again.");
        }
      } else {
        throw error;
      }
    }
  },

  /**
   * Creates a new article (requires authentication and CSRF).
   * @param {object} articleData - Data for the new article.
   * @returns {Promise<object>} The created article object.
   * @throws {Error} If creation fails.
   */
  async createArticle(articleData) {
    // Token refresh logic is generally less critical here as user likely
    // just logged in or performed another action, but could be added
    // similar to getArticles if needed for long-lived sessions.
    return this.makeRequest(
      `${this.baseUrl}/admin/articles`,
      "POST",
      articleData,
    );
  },

  /**
   * Updates an existing article (requires authentication and CSRF).
   * @param {string|number} id - The ID of the article to update.
   * @param {object} articleData - New data for the article.
   * @returns {Promise<object>} The updated article object.
   * @throws {Error} If update fails.
   */
  async updateArticle(id, articleData) {
    return this.makeRequest(
      `${this.baseUrl}/admin/articles/${id}`,
      "PUT",
      articleData,
    );
  },

  /**
   * Deletes an article (requires authentication and CSRF).
   * @param {string|number} id - The ID of the article to delete.
   * @returns {Promise<null>} Null on success (or based on makeRequest's handling of 204).
   * @throws {Error} If deletion fails.
   */
  async deleteArticle(id) {
    return this.makeRequest(`${this.baseUrl}/admin/articles/${id}`, "DELETE");
  },
};

// --- Auth Service ---
const AuthService = {
  isLoggedIn() {
    const token = localStorage.getItem("accessToken");
    // Basic check, could add token expiry validation later
    return token !== null;
  },

  setTokens(accessToken, refreshToken) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    console.log("Tokens set in localStorage.");
  },

  clearTokens() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    ApiService.csrfToken = null; // Also clear the CSRF token from memory
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
    articleContent: document.getElementById("article-content"), // Hidden input for Quill content
    articleId: document.getElementById("article-id"),
    articleTitle: document.getElementById("article-title"),
    articleCategory: document.getElementById("article-category"),
    articleAuthor: document.getElementById("article-author"),
    articleImage: document.getElementById("article-image"),
    articleSubmit: document.getElementById("article-submit"),
    articleFormMessage: document.getElementById("article-form-message"),
    loginMessage: document.getElementById("login-message"),
    articlesContainer: document.getElementById("articles-container"),
    editorContainer: document.getElementById("editor-container"),
  },

  quill: null, // To hold the Quill instance

  /**
   * Initializes the Admin UI: sets up Quill, event listeners, and initial state.
   */
  initialize() {
    this.initQuillEditor();
    this.setupEventListeners();
    this.updateUI();
  },

  /**
   * Initializes the Quill rich text editor if the container exists.
   */
  initQuillEditor() {
    if (this.elements.editorContainer) {
      try {
        this.quill = new Quill(this.elements.editorContainer, {
          theme: "snow",
          modules: {
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ color: [] }, { background: [] }],
              ["link", "image"], // Consider security implications of allowing image uploads/links
              ["clean"],
            ],
          },
          placeholder: "Write your article content here...",
        });

        // Sync Quill content to hidden input on text change
        this.quill.on("text-change", () => {
          if (this.elements.articleContent) {
            this.elements.articleContent.value = this.quill.root.innerHTML;
          }
        });
        console.log("Quill editor initialized.");
      } catch (error) {
        console.error("Failed to initialize Quill:", error);
        // Optionally display a message to the user that the editor failed
      }
    } else {
      console.warn("Quill editor container (#editor-container) not found.");
    }
  },

  /**
   * Sets up event listeners for forms and buttons.
   */
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
    console.log("AdminUI event listeners set up.");
  },

  /**
   * Updates the visibility of UI panels based on login status.
   */
  updateUI() {
    const loggedIn = AuthService.isLoggedIn();
    console.log("Updating UI, loggedIn status:", loggedIn);
    if (loggedIn) {
      this.elements.loginPanel?.classList.add("hidden");
      this.elements.adminPanel?.classList.remove("hidden");
      this.loadArticles(); // Load articles when logged in
    } else {
      this.elements.loginPanel?.classList.remove("hidden");
      this.elements.adminPanel?.classList.add("hidden");
      if (this.elements.articlesContainer)
        this.elements.articlesContainer.innerHTML = ""; // Clear articles if logged out
    }
  },

  /**
   * Loads articles from the API and renders them.
   */
  async loadArticles() {
    if (!this.elements.articlesContainer) return;

    this.elements.articlesContainer.innerHTML =
      '<p class="text-center p-4">Loading articles...</p>'; // Loading indicator
    try {
      const articles = await ApiService.getArticles();
      this.renderArticles(articles || []); // Handle null/undefined API response
    } catch (err) {
      console.error("Error loading articles in loadArticles:", err);
      this.elements.articlesContainer.innerHTML = `<p class="text-red-500 text-center p-4">Failed to load articles: ${err.message}</p>`;
      // If session expired during load, updateUI will handle redirect
      if (err.message.includes("Session expired")) {
        // No need to call updateUI here, the error is caught, and flow continues.
        // If getArticles *didn't* throw Session Expired but caused logout,
        // a subsequent action would trigger the check.
      }
    }
  },

  /**
   * Renders the list of articles in the UI.
   * @param {Array<object>} articles - Array of article objects.
   */
  renderArticles(articles) {
    if (!this.elements.articlesContainer) return;

    if (!articles || articles.length === 0) {
      this.elements.articlesContainer.innerHTML =
        "<p class='text-center p-4'>No articles found.</p>";
      return;
    }

    this.elements.articlesContainer.innerHTML = articles
      .map(
        (article) => `
            <div class="article-card border dark:border-gray-600 rounded-lg shadow-md mb-4 overflow-hidden bg-white dark:bg-gray-700">
                ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover">` : '<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300">No Image</div>'}
                <div class="p-4">
                    <h3 class="text-lg font-bold mb-1 dark:text-white">${article.title}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Category: ${article.category}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Author: ${article.author}</p>
                    <div class="mt-2 flex space-x-2">
                        <button class="edit-article btn btn-blue text-sm py-1 px-3" data-id="${article.id}">Edit</button>
                        <button class="delete-article btn btn-red text-sm py-1 px-3" data-id="${article.id}">Delete</button>
                    </div>
                </div>
            </div>
        `,
      )
      .join("");

    // Add event listeners AFTER rendering
    this.elements.articlesContainer
      .querySelectorAll(".edit-article")
      .forEach((button) => {
        button.addEventListener("click", () => {
          console.log("Edit button clicked for ID:", button.dataset.id);
          this.loadArticleForEditing(button.dataset.id);
        });
      });

    this.elements.articlesContainer
      .querySelectorAll(".delete-article")
      .forEach((button) => {
        button.addEventListener("click", () => {
          console.log("Delete button clicked for ID:", button.dataset.id);
          this.handleDeleteArticle(button.dataset.id);
        });
      });
    console.log("Article cards rendered and event listeners attached.");
  },

  /**
   * Loads a specific article's data into the form for editing.
   * @param {string|number} articleId - The ID of the article to edit.
   */
  async loadArticleForEditing(articleId) {
    if (!this.elements.articleFormContainer || !this.elements.articleForm)
      return;

    console.log(`Attempting to load article ${articleId} for editing.`);
    this.displayMessage(
      this.elements.articleFormMessage,
      "Loading article data...",
      false,
    );

    try {
      const article = await ApiService.getArticle(articleId);
      if (!article) throw new Error("Article not found by API");

      // Populate form fields
      this.elements.articleId.value = article.id;
      this.elements.articleTitle.value = article.title;

      // Set Quill content
      if (this.quill) {
        this.quill.root.innerHTML = article.content || "";
        if (this.elements.articleContent)
          this.elements.articleContent.value = article.content || "";
      } else if (this.elements.articleContent) {
        this.elements.articleContent.value = article.content || ""; // Fallback
      }

      this.elements.articleCategory.value = article.category;
      this.elements.articleAuthor.value = article.author;
      this.elements.articleImage.value = article.imageUrl || "";

      // Update form state
      this.elements.articleSubmit.textContent = "Update Article";
      this.displayMessage(this.elements.articleFormMessage, "", false); // Clear loading message
      this.elements.articleFormContainer.classList.remove("hidden");
      this.elements.articleForm.scrollIntoView({ behavior: "smooth" });
      console.log(`Article ${articleId} loaded into form.`);
    } catch (err) {
      console.error("Error loading article for editing:", err);
      this.displayMessage(
        this.elements.articleFormMessage,
        `Error loading article: ${err.message}`,
        true,
      );
      // Handle potential session expiry
      if (err.message.includes("Session expired")) {
        this.updateUI(); // Let updateUI handle redirect
      }
    }
  },

  /**
   * Resets the article form to its default state.
   */
  resetForm() {
    if (!this.elements.articleForm) return;
    this.elements.articleForm.reset();
    if (this.quill) this.quill.root.innerHTML = "";
    this.elements.articleId.value = "";
    if (this.elements.articleContent) this.elements.articleContent.value = "";
    this.elements.articleSubmit.textContent = "Create Article";
    if (this.elements.articleFormMessage) {
      this.elements.articleFormMessage.textContent = "";
      this.elements.articleFormMessage.className = "mt-2 text-sm";
    }
    console.log("Article form reset.");
  },

  /**
   * Displays a message in the specified message element.
   * @param {HTMLElement|null} messageElement - The element to display the message in.
   * @param {string} message - The message text.
   * @param {boolean} [isError=false] - Whether the message is an error.
   */
  displayMessage(messageElement, message, isError = false) {
    if (!messageElement) {
      console.warn(
        "Attempted to display message, but message element is missing.",
      );
      return;
    }
    messageElement.textContent = message;
    // Use Tailwind classes for styling
    messageElement.className = `mt-2 text-sm ${isError ? "text-red-500" : "text-green-500"}`;
  },

  // --- Event Handlers ---

  /**
   * Handles the admin login form submission.
   * @param {Event} e - The form submission event.
   */
  async handleLogin(e) {
    e.preventDefault();
    if (!this.elements.loginForm) return;

    const usernameInput = this.elements.loginForm.querySelector("#username");
    const passwordInput = this.elements.loginForm.querySelector("#password");
    const username = usernameInput?.value.trim(); // Trim whitespace
    const password = passwordInput?.value; // Don't trim password

    console.log("--- handleLogin Start ---");
    console.log("Username (from input):", username);

    if (!username || !password) {
      this.displayMessage(
        this.elements.loginMessage,
        "Username and password are required.",
        true,
      );
      console.log("Login aborted: missing username or password.");
      return;
    }

    this.displayMessage(this.elements.loginMessage, "Logging in...", false);

    try {
      const data = await ApiService.login(username, password);
      AuthService.setTokens(data.accessToken, data.refreshToken);
      this.displayMessage(
        this.elements.loginMessage,
        "Login successful!",
        false,
      );
      // Fetch CSRF token *after* successful login before potentially needed by subsequent actions
      // Although makeRequest handles it, pre-fetching might be slightly smoother.
      // await ApiService.fetchCsrfToken(); // No longer strictly necessary here due to makeRequest logic
      this.updateUI();
    } catch (err) {
      console.error("Login Error (in handleLogin):", err);
      this.displayMessage(
        this.elements.loginMessage,
        `Error: ${err.message}`,
        true,
      );
      // Do not call updateUI() on error, keep login form visible
    }
    console.log("--- handleLogin End ---");
  },

  /**
   * Handles the article creation/update form submission.
   * @param {Event} e - The form submission event.
   */
  async handleArticleSubmit(e) {
    e.preventDefault();
    if (!this.elements.articleForm) return;

    // Sync Quill content before getting data
    if (this.quill && this.elements.articleContent) {
      this.elements.articleContent.value = this.quill.root.innerHTML;
    }

    const articleId = this.elements.articleId.value;
    const articleData = {
      title: this.elements.articleTitle.value.trim(),
      content: this.elements.articleContent.value, // Content from hidden input (synced from Quill)
      category: this.elements.articleCategory.value,
      author: this.elements.articleAuthor.value.trim(),
      imageUrl: this.elements.articleImage.value.trim() || null, // Send null if empty after trimming
    };

    // Basic validation
    if (
      !articleData.title ||
      !articleData.content ||
      !articleData.category ||
      !articleData.author
    ) {
      this.displayMessage(
        this.elements.articleFormMessage,
        "Title, Content, Category, and Author are required.",
        true,
      );
      return;
    }

    const action = articleId ? "Updating" : "Creating";
    console.log(`${action} article with data:`, {
      ...articleData,
      content: "...",
    }); // Avoid logging full content
    this.displayMessage(
      this.elements.articleFormMessage,
      `${action} article...`,
      false,
    );

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
      console.log(`Article ${action} successful:`, result);

      this.resetForm();
      this.elements.articleFormContainer?.classList.add("hidden");
      this.loadArticles();
    } catch (err) {
      console.error(`Article ${action} Error:`, err);
      this.displayMessage(
        this.elements.articleFormMessage,
        `Error: ${err.message}`,
        true,
      );
      // Handle potential session expiry during submit
      if (err.message.includes("Session expired")) {
        this.updateUI(); // Let updateUI handle redirect
      }
    }
  },

  /**
   * Handles the click on a delete article button.
   * @param {string|number} articleId - The ID of the article to delete.
   */
  async handleDeleteArticle(articleId) {
    if (
      !confirm(
        `Are you sure you want to delete article ID ${articleId}? This cannot be undone.`,
      )
    ) {
      return;
    }

    console.log(`Attempting to delete article ${articleId}...`);
    // Consider adding visual feedback (disabling button, etc.)

    try {
      await ApiService.deleteArticle(articleId); // Returns null on success (204)
      console.log(`Article ${articleId} deleted successfully.`);
      alert(`Article ${articleId} deleted successfully.`); // Simple user feedback
      this.loadArticles(); // Refresh the list
    } catch (err) {
      console.error("Error deleting article:", err);
      alert(`Failed to delete article: ${err.message}`);
      // Handle potential session expiry during delete
      if (err.message.includes("Session expired")) {
        this.updateUI(); // Let updateUI handle redirect
      }
    }
  },

  /**
   * Handles the click on the "Create New Article" button.
   */
  handleNewArticleClick() {
    if (!this.elements.articleFormContainer) return;
    this.resetForm();
    this.elements.articleFormContainer.classList.remove("hidden");
    this.elements.articleForm?.scrollIntoView({ behavior: "smooth" });
    console.log("New article form shown.");
  },

  /**
   * Handles the click on the "Cancel" button in the article form.
   */
  handleCancelClick() {
    if (!this.elements.articleFormContainer) return;
    this.resetForm();
    this.elements.articleFormContainer.classList.add("hidden");
    console.log("Article form cancelled and hidden.");
  },

  /**
   * Handles the click on the "Logout" button.
   */
  handleLogout() {
    console.log("Logout initiated.");
    AuthService.clearTokens();
    this.updateUI();
    // Could add explicit redirect: window.location.href = '/';
  },
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing AdminUI.");
  AdminUI.initialize();
});
