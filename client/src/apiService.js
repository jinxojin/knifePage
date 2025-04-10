// client/src/apiService.js
// Service for public-facing API calls

const BASE_URL = "/api"; // Ensure this matches your server setup

/**
 * Makes a generic public API request (primarily GET).
 * Handles basic error checking and JSON parsing.
 * @param {string} path - The API endpoint path (e.g., '/articles', '/articles/category/news')
 * @param {object} [queryParams={}] - Optional query parameters as key-value pairs.
 * @returns {Promise<object|array>} The parsed JSON response.
 * @throws {Error} If the request fails or returns a non-OK status.
 */
async function makePublicRequest(path, queryParams = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  // Add query parameters to the URL, removing undefined/null values
  Object.keys(queryParams).forEach((key) => {
    if (queryParams[key] !== undefined && queryParams[key] !== null) {
      url.searchParams.append(key, queryParams[key]);
    }
  });

  console.log(`[Public API] Fetching: ${url.toString()}`); // Log the request
  console.log("ApiService: makeRequest called:", method, fetchPath);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      // No 'credentials: include' needed for public requests unless specifically required by API
      headers: {
        Accept: "application/json", // Indicate we want JSON back
      },
    });

    console.log(
      `[Public API] Status for ${path} with params ${JSON.stringify(queryParams)}: ${response.status}`,
    );

    if (!response.ok) {
      let errorMsg = `API Request Failed: ${response.status} ${response.statusText}`;
      let responseText = "";
      try {
        responseText = await response.text();
        console.error(
          `[Public API] Non-OK response text for ${path}:`,
          responseText,
        );
        const contentType = response.headers.get("content-type");
        // Try parsing only if server indicates JSON error response
        if (contentType && contentType.includes("application/json")) {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.message || errorMsg; // Use server's message if available
        } else {
          // Append snippet of non-JSON response otherwise
          errorMsg += ` - Response: ${responseText.substring(0, 150)}${responseText.length > 150 ? "..." : ""}`;
        }
      } catch (e) {
        console.warn(
          `[Public API] Could not fully process error response for ${path}:`,
          e,
        );
        // Fallback error message if reading/parsing text fails
        errorMsg += ` - Could not read server response body.`;
      }
      throw new Error(errorMsg);
    }

    // Check content type for success response
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      console.error(
        `[Public API] Expected JSON, but received Content-Type: ${contentType} for ${path}. Response text:`,
        responseText,
      );
      throw new Error(
        `Received invalid content type from server: ${contentType}`,
      );
    }

    // Parse the valid JSON response
    const data = await response.json();
    console.log(`[Public API] Received data for ${path}:`, data); // Optional: Log success data
    return data;
  } catch (error) {
    // Catches network errors and errors thrown above
    console.error(
      `[Public API] Network or processing error for ${path}:`,
      error,
    );
    // Re-throw the error so the calling function (in page scripts) can handle UI updates
    throw error;
  }
}

// --- Specific Public API Functions ---

/**
 * Fetches articles, supporting pagination, category filtering, and language.
 * Calls GET /api/articles
 * @param {object} params - Parameters object.
 * @param {number} [params.page=1] - Page number.
 * @param {number} [params.limit] - Items per page.
 * @param {string} [params.category] - Comma-separated categories (e.g., 'news,blog').
 * @param {string} [params.lang] - Language code.
 * @returns {Promise<{totalArticles: number, totalPages: number, currentPage: number, articles: array}>}
 */
export async function getPublicArticles({
  page = 1,
  limit,
  category,
  lang,
} = {}) {
  const queryParams = { page, limit, category, lang };
  return makePublicRequest("/articles", queryParams);
}

/**
 * Fetches articles by a single category slug. Usually for highlights.
 * Calls GET /api/articles/category/:category
 * @param {string} categorySlug - The category slug (e.g., 'news', 'competition').
 * @param {object} params - Parameters object.
 * @param {number} [params.limit=1] - Max items to return.
 * @param {string} [params.lang] - Language code.
 * @returns {Promise<array>} An array of article objects.
 */
export async function getArticlesByCategorySlug(
  categorySlug,
  { limit = 1, lang } = {},
) {
  if (!categorySlug)
    throw new Error("Category slug is required for getArticlesByCategorySlug.");
  const queryParams = { limit, lang };
  return makePublicRequest(`/articles/category/${categorySlug}`, queryParams);
}

/**
 * Fetches a single article by ID for public view.
 * Calls GET /api/articles/:id
 * @param {string|number} id - The article ID.
 * @param {object} params - Parameters object.
 * @param {string} [params.lang] - Language code.
 * @returns {Promise<object>} The article object.
 */
export async function getPublicArticleById(id, { lang } = {}) {
  if (!id) throw new Error("Article ID is required for getPublicArticleById.");
  const queryParams = { lang };
  return makePublicRequest(`/articles/${id}`, queryParams);
}
