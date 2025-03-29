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
      // console.log("CSRF Token fetched:", this.csrfToken); // Keep logs minimal for production build
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
   * @returns {Promise<object|null>} The parsed JSON response, or null for non-JSON responses.
   * @throws {Error} If the request fails or returns a non-OK status.
   */
  async makeRequest(url, method = "GET", data = null, isRetry = false) {
    // Fetch CSRF token if needed for state-changing methods and not already present or retrying
    if (
      !this.csrfToken &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase()) &&
      !isRetry // Don't fetch if this is already a CSRF retry
    ) {
      try {
        await this.fetchCsrfToken();
      } catch (csrfError) {
        console.error("Failed to pre-fetch CSRF token:", csrfError);
        // Allow the request to proceed, it might fail later with 403 if token is truly needed
        // Or re-throw if CSRF fetch is critical: throw csrfError;
      }
    }

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      // Authorization added conditionally
    };
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add CSRF token header if available and method requires it
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
      credentials: "include", // Send cookies and authorization headers
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // --- CSRF Token Retry Logic ---
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
            this.csrfToken = null; // Invalidate stored token
            await this.fetchCsrfToken(); // Explicitly fetch a new token now
            return this.makeRequest(url, method, data, true); // Retry ONCE
          }
        } catch (e) {
          console.error(
            "Could not parse potential CSRF error response body:",
            e,
          );
        }
      }
      // --- End CSRF Token Retry Logic ---

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
        // Extract validation errors if available
        const errors = errorData.errors;
        const errorMessage =
          errorData.message || `Request failed: ${response.status}`;
        console.error(`Request failed: ${response.status}`, errorData);
        const error = new Error(errorMessage);
        if (errors) {
          error.errors = errors; // Attach validation errors to the error object
        }
        throw error;
      }

      // Handle responses that might not be JSON (though most API endpoints should be)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.log(
          `Received non-JSON response for ${method} ${url} (Status: ${response.status})`,
        );
        // Depending on API design, you might return response.text() or null
        return await response.text(); // Or return null;
      }

      const responseData = await response.json();
      return responseData;
    } catch (networkError) {
      console.error(
        `Network or API error during ${method} request to ${url}:`,
        networkError,
      );
      // Attach validation errors if they were added to the error object
      if (networkError.errors) {
        throw networkError;
      }
      // Rethrow a potentially simplified error for the UI layer
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
      throw error; // Re-throw for UI handler
    }
  },

  async refreshToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      return null;
    }
    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/admin/refresh`,
        "POST",
        { refreshToken },
      );

      return data.accessToken;
    } catch (error) {
      console.error("Refresh token failed:", error);
      AuthService.clearTokens(); // Clear tokens on refresh failure
      throw error; // Re-throw the error from makeRequest
    }
  },

  /** Handles API calls requiring auth, includes token refresh logic */
  async makeAuthenticatedRequest(url, method = "GET", data = null) {
    try {
      // Initial attempt
      return await this.makeRequest(url, method, data);
    } catch (error) {
      // Check for 401 Unauthorized or 403 Forbidden (could be expired token)
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
            // Retry the original request ONCE
            return await this.makeRequest(url, method, data);
          } else {
            // Refresh failed or no refresh token
            console.error(
              "Token refresh failed or not possible. Clearing session.",
            );
            AuthService.clearTokens();
            window.location.href = "/admin.html"; // Redirect to login
            throw new Error("Session expired. Please log in again.");
          }
        } catch (refreshError) {
          // Error occurred *during* the refresh attempt itself
          console.error("Error during token refresh attempt:", refreshError);
          AuthService.clearTokens();
          window.location.href = "/admin.html";
          throw new Error("Session expired. Please log in again.");
        }
      } else {
        // Not an auth error, re-throw the original error
        console.error(`Non-authorization error on ${method} ${url}:`, error);
        throw error;
      }
    }
  },

  async getArticles() {
    // Refactored to use makeAuthenticatedRequest
    return this.makeAuthenticatedRequest(`${this.baseUrl}/articles`);
  },

  async getArticle(id) {
    // Refactored to use makeAuthenticatedRequest
    return this.makeAuthenticatedRequest(`${this.baseUrl}/articles/${id}`);
  },

  async createArticle(articleData) {
    // Refactored to use makeAuthenticatedRequest
    // Note: CSRF token is handled within makeRequest/makeAuthenticatedRequest
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles`,
      "POST",
      articleData,
    );
  },

  async updateArticle(id, articleData) {
    // Refactored to use makeAuthenticatedRequest
    return this.makeAuthenticatedRequest(
      `${this.baseUrl}/admin/articles/${id}`,
      "PUT",
      articleData,
    );
  },

  async deleteArticle(id) {
    // Refactored to use makeAuthenticatedRequest
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
    formHeading: document.getElementById("form-heading"),
    // Form Fields (Language Specific)
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
    // Form Fields (Common)
    articleId: document.getElementById("article-id"),
    articleCategory: document.getElementById("article-category"),
    articleAuthor: document.getElementById("article-author"),
    articleImage: document.getElementById("article-image"),
    articleSubmit: document.getElementById("article-submit"),
    // Messages & Containers
    articleFormMessage: document.getElementById("article-form-message"),
    loginMessage: document.getElementById("login-message"),
    articlesContainer: document.getElementById("articles-container"),
    // editorContainer is now language specific
  },

  // Store multiple Quill instances
  quillInstances: {
    en: null,
    rus: null,
    mng: null,
  },

  /**
   * Initializes the Admin UI: sets up Quill, event listeners, and initial state.
   */
  initialize() {
    this.initQuillEditor();
    this.setupEventListeners();
    this.updateUI(); // Initial UI state based on login status
  },

  /**
   * Initializes Quill editors for each language.
   */
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

          // Sync content to hidden input
          this.quillInstances[lang].on("text-change", () => {
            hiddenInput.value = this.quillInstances[lang].root.innerHTML;
          });
        } catch (error) {
          console.error(`Failed to initialize Quill for ${lang}:`, error);
          this.displayMessage(
            this.elements.articleFormMessage,
            `Failed to load ${lang.toUpperCase()} text editor.`,
            true
          );
        }
      } else {
        console.warn(`Quill container/input not found for language: ${lang}`);
      }
    };

    initializeInstance('en');
    initializeInstance('rus');
    initializeInstance('mng');
  },

  /**
              // Standard toolbar
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ color: [] }, { background: [] }], // Color options
              ["link", "image"], // Basic link and image insertion (image handling needs more work for uploads)
              ["clean"], // Remove formatting button
            ],
            // Add handlers later for custom functionality like image uploads
          },
          placeholder: "Write your article content here...",
        });

   * Sets up event listeners for forms and buttons.
   */
  setupEventListeners() {
    // Use optional chaining for safety
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

  /**
   * Updates the visibility of UI panels based on login status.
   */
  updateUI() {
    const loggedIn = AuthService.isLoggedIn();
    if (loggedIn) {
      this.elements.loginPanel?.classList.add("hidden");
      this.elements.adminPanel?.classList.remove("hidden");
      this.loadArticles(); // Load articles when logged in and UI updated
    } else {
      this.elements.loginPanel?.classList.remove("hidden");
      this.elements.adminPanel?.classList.add("hidden");
      if (this.elements.articlesContainer)
        this.elements.articlesContainer.innerHTML = ""; // Clear articles if logged out
      if (this.elements.articleFormContainer)
        this.elements.articleFormContainer.classList.add("hidden"); // Hide form if logged out
    }
  },

  /**
   * Loads articles from the API and renders them.
   */
  async loadArticles() {
    if (!this.elements.articlesContainer) return;

    this.elements.articlesContainer.innerHTML =
      '<p class="text-center p-4 col-span-full">Loading articles...</p>'; // Loading indicator
    try {
      // Use the authenticated request helper which includes refresh logic
      const articles = await ApiService.getArticles(); // Was makeAuthenticatedRequest before refactor
      this.renderArticles(articles || []);
    } catch (err) {
      console.error("Error loading articles in loadArticles:", err);
      this.elements.articlesContainer.innerHTML = `<p class="text-red-500 text-center p-4 col-span-full">Failed to load articles: ${err.message}</p>`;
      // No need to manually trigger updateUI on session expired, error handling in ApiService handles it
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
        "<p class='text-center p-4 col-span-full'>No articles found.</p>";
      return;
    }

    // Use grid layout defined in admin.html
    this.elements.articlesContainer.innerHTML = articles
      .map(
        (article) => `
          <div class="article-card border dark:border-gray-600 rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-700 flex flex-col">
              ${
                article.imageUrl
                  ? `<img src="${article.imageUrl}" alt="${article.title}" class="w-full h-48 object-cover">`
                  : '<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-300">No Image</div>'
              }
              <div class="p-4 flex flex-col flex-grow">
                  <h3 class="text-lg font-bold mb-1 dark:text-white flex-grow">${article.title}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Category: ${article.category}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Author: ${article.author}</p>

                  <div class="mt-auto pt-2 flex space-x-2">
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
        button.addEventListener("click", (e) => {
          const id = e.currentTarget.dataset.id;
          console.log("Edit button clicked for ID:", id);
          this.loadArticleForEditing(id);
        });
      });

    this.elements.articlesContainer
      .querySelectorAll(".delete-article")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const id = e.currentTarget.dataset.id;
          console.log("Delete button clicked for ID:", id);
          this.handleDeleteArticle(id);
        });
      });
  },

  /**
   * Loads a specific article's data into the form for editing.
   * @param {string|number} articleId - The ID of the article to edit.
   */
  async loadArticleForEditing(articleId) {
    if (!this.elements.articleFormContainer || !this.elements.articleForm)
      return;

    this.displayMessage(
      this.elements.articleFormMessage,
      "Loading article data...",
      false,
    );
    this.elements.articleSubmit.disabled = true; // Disable while loading

    try {
      // Use authenticated request helper
      const article = await ApiService.getArticle(articleId); // Was makeAuthenticatedRequest before refactor
      if (!article) throw new Error("Article not found by API");

      // Populate common fields
      this.elements.articleId.value = article.id;
      this.elements.articleCategory.value = article.category;
      this.elements.articleAuthor.value = article.author;
      this.elements.articleImage.value = article.imageUrl || "";

      // Populate language-specific fields
      ['en', 'rus', 'mng'].forEach(lang => {
        const titleInput = this.elements[`articleTitle_${lang}`];
        const excerptInput = this.elements[`articleExcerpt_${lang}`];
        const hiddenContentInput = this.elements[`articleContent_${lang}`];
        const quillInstance = this.quillInstances[lang];

        if (titleInput) titleInput.value = article[`title_${lang}`] || "";
        if (excerptInput) excerptInput.value = article[`excerpt_${lang}`] || "";
        
        const contentToLoad = article[`content_${lang}`] || "";
        if (quillInstance) {
          // Use setContents or pasteHTML to avoid losing formatting if possible, 
          // but innerHTML is simpler for now. Ensure backend sends sanitized HTML.
          quillInstance.root.innerHTML = contentToLoad; 
        }
        if (hiddenContentInput) hiddenContentInput.value = contentToLoad;
      });

      // Update form state
      this.elements.articleSubmit.textContent = "Update Article";
      if (this.elements.formHeading)
        this.elements.formHeading.textContent = "Edit Article";
      this.displayMessage(this.elements.articleFormMessage, "", false); // Clear loading message
      this.elements.articleFormContainer.classList.remove("hidden");
      this.elements.articleForm.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }); // Scroll to top of form
      // console.log(`Article ${articleId} loaded into form.`);
    } catch (err) {
      console.error("Error loading article for editing:", err);
      this.displayMessage(
        this.elements.articleFormMessage,
        `Error loading article: ${err.message}`,
        true,
      );
      // Session expired error is handled by ApiService redirection
    } finally {
      this.elements.articleSubmit.disabled = false; // Re-enable after loading
    }
  },

  /**
   * Resets the article form to its default state.
   */
  resetForm() {
    if (!this.elements.articleForm) return;
    this.elements.articleForm.reset(); // Resets native inputs

    // Clear all Quill editors and hidden inputs
    ['en', 'rus', 'mng'].forEach(lang => {
      const quillInstance = this.quillInstances[lang];
      const hiddenContentInput = this.elements[`articleContent_${lang}`];
      if (quillInstance) quillInstance.root.innerHTML = "";
      if (hiddenContentInput) hiddenContentInput.value = "";
    });

    this.elements.articleId.value = ""; // Clear hidden ID
    this.elements.articleSubmit.textContent = "Create Article";
    if (this.elements.formHeading)
      this.elements.formHeading.textContent = "Create Article";
    if (this.elements.articleFormMessage) {
      // Clear message
      this.elements.articleFormMessage.textContent = "";
      this.elements.articleFormMessage.className = "mt-4 text-center text-sm"; // Reset class
    }
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
    messageElement.className = `mt-4 text-center text-sm ${isError ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
  },

  // --- Event Handlers ---

  /** Handles the admin login form submission. */
  async handleLogin(e) {
    e.preventDefault();
    if (!this.elements.loginForm) return;

    const usernameInput = this.elements.loginForm.querySelector("#username");
    const passwordInput = this.elements.loginForm.querySelector("#password");
    // Ensure elements exist before accessing value
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
      // No need to pre-fetch CSRF token, makeRequest handles it
      this.updateUI(); // Switch to admin panel
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

  /** Handles the article creation/update form submission. */
  async handleArticleSubmit(e) {
    e.preventDefault();
    if (!this.elements.articleForm) return;

    // Sync content from all Quill editors to hidden inputs
    ['en', 'rus', 'mng'].forEach(lang => {
      const quillInstance = this.quillInstances[lang];
      const hiddenContentInput = this.elements[`articleContent_${lang}`];
      if (quillInstance && hiddenContentInput) {
        hiddenContentInput.value = quillInstance.root.innerHTML;
      } else if (!hiddenContentInput) {
         console.error(`Hidden content input not found for ${lang}!`);
         // Handle error appropriately - maybe prevent submission
      }
    });

    const articleId = this.elements.articleId.value;
    
    // Gather data from all fields
    const articleData = {
      // English
      title_en: this.elements.articleTitle_en.value.trim(),
      content_en: this.elements.articleContent_en.value,
      excerpt_en: this.elements.articleExcerpt_en.value.trim() || null,
      // Russian
      title_rus: this.elements.articleTitle_rus.value.trim() || null,
      content_rus: this.elements.articleContent_rus.value || null,
      excerpt_rus: this.elements.articleExcerpt_rus.value.trim() || null,
      // Mongolian
      title_mng: this.elements.articleTitle_mng.value.trim() || null,
      content_mng: this.elements.articleContent_mng.value || null,
      excerpt_mng: this.elements.articleExcerpt_mng.value.trim() || null,
      // Common
      category: this.elements.articleCategory.value,
      author: this.elements.articleAuthor.value.trim(),
      imageUrl: this.elements.articleImage.value.trim() || null,
    };

    // Basic client-side validation (server-side is primary)
    // Only check required fields (English title/content, category, author)
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
      this.elements.articleSubmit.disabled = true; // Disable button

    try {
      let result;
      if (articleId) {
        result = await ApiService.updateArticle(articleId, articleData); // Uses authenticated request
        this.displayMessage(
          this.elements.articleFormMessage,
          "Article updated successfully!",
          false,
        );
      } else {
        result = await ApiService.createArticle(articleData); // Uses authenticated request
        this.displayMessage(
          this.elements.articleFormMessage,
          "Article created successfully!",
          false,
        );
      }
      console.log(`Article ${action} successful:`, result?.id);

      this.resetForm(); // Reset form fields
      this.elements.articleFormContainer?.classList.add("hidden"); // Hide form
      await this.loadArticles(); // Refresh the article list

      // Optionally clear the success message after a delay
      setTimeout(() => {
        if (
          this.elements.articleFormMessage?.textContent.includes("successfully")
        ) {
          this.displayMessage(this.elements.articleFormMessage, "", false);
        }
      }, 3000);
    } catch (err) {
      console.error(`Article ${action} Error:`, err);
      // Try to parse specific validation errors from server response if available
      let errorMessage = `Error: ${err.message}`;
      // Use errors attached to the error object by makeRequest
      if (err.errors && Array.isArray(err.errors)) {
        errorMessage = `Error: ${err.errors.map((e) => `${e.field || "Input"}: ${e.msg || e.message}`).join(", ")}`;
      }
      this.displayMessage(this.elements.articleFormMessage, errorMessage, true);
      // Session expired error is handled by ApiService redirection
    } finally {
      if (this.elements.articleSubmit)
        this.elements.articleSubmit.disabled = false; // Re-enable button
    }
  },

  /** Handles the click on a delete article button. */
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
    // Optional: Add visual feedback (e.g., disable buttons on the card)

    try {
      await ApiService.deleteArticle(articleId); // Uses authenticated request
      console.log(`Article ${articleId} deleted successfully.`);
      // Give user feedback - alert is simple, could use a toast notification library
      alert(`Article ${articleId} deleted successfully.`);
      this.loadArticles(); // Refresh the list
    } catch (err) {
      console.error("Error deleting article:", err);
      alert(`Failed to delete article: ${err.message}`);
      // Session expired error is handled by ApiService redirection
    }
  },

  /** Handles the click on the "Create New Article" button. */
  handleNewArticleClick() {
    if (!this.elements.articleFormContainer) return;
    this.resetForm(); // Reset form for new entry
    this.elements.articleFormContainer.classList.remove("hidden"); // Show form
    this.elements.articleForm?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    }); // Scroll to form
    // console.log("New article form shown.");
  },

  /** Handles the click on the "Cancel" button in the article form. */
  handleCancelClick() {
    if (!this.elements.articleFormContainer) return;
    this.resetForm(); // Clear any entered data
    this.elements.articleFormContainer.classList.add("hidden"); // Hide form
    // console.log("Article form cancelled and hidden.");
  },

  /** Handles the click on the "Logout" button. */
  handleLogout() {
    console.log("Logout initiated.");
    AuthService.clearTokens();
    this.updateUI(); // Show login panel
    // Optional: Redirect to home page or login page explicitly
    // window.location.href = '/';
  },
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  AdminUI.initialize();
});
