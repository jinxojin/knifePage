// client/src/apiService.js
// Service for public-facing API calls
import { t, currentLang } from "./i18n.js"; // Import i18n if using t() in errors

const BASE_URL = "/api"; // Keep this relative path for proxies

/**
 * Makes a generic public API request (primarily GET).
 * Handles basic error checking and JSON parsing.
 * @param {string} path - The API endpoint path (e.g., '/articles', '/articles/category/news')
 * @param {object} [queryParams={}] - Optional query parameters as key-value pairs.
 * @returns {Promise<object|array>} The parsed JSON response.
 * @throws {Error} If the request fails or returns a non-OK status.
 */
async function makePublicRequest(path, queryParams = {}) {
  let fetchUrl = `${BASE_URL}${path}`;
  const searchParams = new URLSearchParams();

  Object.keys(queryParams).forEach((key) => {
    if (queryParams[key] !== undefined && queryParams[key] !== null) {
      searchParams.append(key, queryParams[key]);
    }
  });

  const queryString = searchParams.toString();
  if (queryString) {
    fetchUrl += `?${queryString}`;
  }

  // <<< Log 15 >>>
  console.log(`[apiService.js] makePublicRequest - Fetching URL: ${fetchUrl}`);

  try {
    // <<< Log 16 >>>
    console.log(
      `[apiService.js] makePublicRequest - About to execute fetch for: ${fetchUrl}`,
    );
    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    // <<< Log 17 (After fetch attempt) >>>
    console.log(
      `[apiService.js] makePublicRequest - Fetch executed for: ${fetchUrl}, Status: ${response.status}`,
    );

    if (!response.ok) {
      let errorMsg = `API Request Failed: ${response.status} ${response.statusText}`;
      let responseText = "";
      try {
        responseText = await response.text();
        console.error(
          `[apiService.js] Non-OK response text for ${fetchUrl}:`,
          responseText,
        );
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.message || errorMsg;
        } else {
          errorMsg += ` - Response: ${responseText.substring(0, 150)}${responseText.length > 150 ? "..." : ""}`;
        }
      } catch (e) {
        console.warn(
          `[apiService.js] Could not fully process error response for ${fetchUrl}:`,
          e,
        );
        errorMsg += ` - Could not read server response body.`;
      }
      throw new Error(errorMsg);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      console.error(
        `[apiService.js] Expected JSON, but received Content-Type: ${contentType} for ${fetchUrl}. Response text:`,
        responseText,
      );
      throw new Error(
        `Received invalid content type from server: ${contentType}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // <<< Log 18 (Error Path) >>>
    console.error(
      `[apiService.js] makePublicRequest - Network/processing error for ${fetchUrl}:`,
      error,
    );
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
    throw new Error(
      t("Category slug is required for getArticlesByCategorySlug."),
    ); // Use t() if available
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
  if (!id)
    throw new Error(t("Article ID is required for getPublicArticleById.")); // Use t() if available
  const queryParams = { lang };
  // <<< Log 19 >>>
  console.log(
    `[apiService.js] getPublicArticleById - Calling makePublicRequest for ID: ${id}`,
  );
  return makePublicRequest(`/articles/${id}`, queryParams);
}
