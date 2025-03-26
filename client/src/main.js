// client/src/main.js
import "./style.css";
// Import necessary functions from date-fns
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
// Import only needed utils from articles.js
import { utils } from "./articles.js";
const { createArticleExcerpt } = utils; // Get the excerpt function

// --- Constants ---
const API_URL = "https://localhost:3000/api";
const CATEGORIES = ["competition", "news", "blog"];

// --- DOM Elements ---
const burgerBtn = document.getElementById("burger-btn");
const languageBtn = document.getElementById("language-btn");

// --- Helper Function (Copied from articles.js - consider refactoring to a shared utils file later) ---
/**
 * Generates the display string and hover string for timestamps based on age.
 * @param {Date} dateObj - The date object for the article's creation time.
 * @returns {{displayString: string, hoverString: string}}
 */
function getConditionalTimestampStrings(dateObj) {
  let displayString = "Unknown date";
  let hoverString = "";
  const now = new Date();

  try {
    const hoursDifference = differenceInHours(now, dateObj);
    const fullDateFormat = format(dateObj, "do MMMM, yyyy"); // e.g., 26th March, 2025
    const relativeTimeFormat = formatDistanceToNow(dateObj, {
      addSuffix: true,
    }); // e.g., about 5 hours ago

    if (hoursDifference < 24) {
      // Less than 24 hours old: Display relative time, show full date on hover
      displayString = relativeTimeFormat;
      hoverString = fullDateFormat;
    } else {
      // 24 hours or older: Display full date, show relative time on hover
      displayString = fullDateFormat;
      hoverString = relativeTimeFormat;
    }
  } catch (e) {
    console.error(
      "Error processing date for conditional timestamp:",
      dateObj,
      e,
    );
    hoverString = "Invalid date";
  }
  return { displayString, hoverString };
}

// --- API Fetching ---
/**
 * Fetches the single latest article for a given category.
 * @param {string} category - The category name.
 * @returns {Promise<object|null>} The latest article object or null if none found/error.
 */
async function fetchLatestArticle(category) {
  try {
    const response = await fetch(
      `${API_URL}/articles/category/${category}?limit=1`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`No articles found for category: ${category}`);
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const articles = await response.json();
    return articles[0] || null; // Return the first article or null
  } catch (error) {
    console.error(`Error fetching latest ${category} article:`, error);
    return null; // Return null on error
  }
}

// --- Rendering Functions ---
/**
 * Updates the highlight card for a specific category with article data.
 * @param {string} category - The category name (e.g., 'competition').
 * @param {object|null} article - The article object or null.
 */
function updateHighlightCard(category, article) {
  const container = document.getElementById(`highlight-${category}`);
  if (!container) {
    console.warn(`Highlight container not found for category: ${category}`);
    return;
  }

  // --- Handle No Article Found ---
  if (!article) {
    container.innerHTML = `
            <div class="p-5 text-center">
                <h5 class="mb-2 text-xl font-medium text-gray-700 dark:text-gray-300">No recent ${category} article found</h5>
                <p class="text-gray-500 dark:text-gray-400">Check back later for updates.</p>
            </div>
            `;
    return;
  }

  // --- Prepare Data for Rendering ---
  // Generate excerpt using existing function
  const excerpt = createArticleExcerpt(article.content, 150);

  // Use Conditional Timestamp Logic
  const dateObj = new Date(article.createdAt);
  const { displayString, hoverString } =
    getConditionalTimestampStrings(dateObj);

  // --- Render HTML ---
  container.innerHTML = `
        <a href="/article.html?id=${article.id}" class="block group focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded-t-lg">
             <img class="rounded-t-lg object-cover w-full h-48 transition-opacity duration-300 group-hover:opacity-80" src="${
               article.imageUrl || "./assets/placeholder-image.jpg" // Use a consistent placeholder
             }"
                 alt="${article.title}" />
        </a>
        <div class="p-5">
            <div class="flex justify-between items-center text-gray-500 dark:text-gray-400 text-xs mb-2">
                <span class="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded text-xs font-medium capitalize">${article.category}</span>
                <span title="${hoverString}">${displayString}</span>
            </div>

            <a href="/article.html?id=${article.id}" class="block focus:outline-none">
                <h5 class="mb-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                    ${article.title}
                </h5>
            </a>

            <p class="mb-4 font-normal text-gray-700 dark:text-gray-300 line-clamp-3">
                ${excerpt}
            </p>

            <div class="flex justify-between items-center mt-4">
                <a href="/article.html?id=${article.id}"
                    class="bg-primary-700 dark:bg-primary-600 inline-flex items-center rounded-lg px-3 py-2 text-center text-sm font-medium text-white hover:bg-primary-800 dark:hover:bg-primary-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 focus:outline-none transition-colors duration-200">
                    Read more
                    <svg class="ms-2 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                    </svg>
                </a>
                <span class="text-sm text-gray-500 dark:text-gray-400" id="views-${article.id}"></span>
            </div>
        </div>
        `;
}

// --- UI Initialization ---

/**
 * Creates the mobile menu and sets up its toggle behavior.
 */
function createMobileMenu() {
  if (!burgerBtn) return;
  const navUl = document.querySelector("header nav ul");
  if (!navUl) return;

  const dropdown = document.createElement("div");
  dropdown.id = "mobile-menu";
  dropdown.className = `md:hidden fixed top-12 left-0 right-0 w-full bg-white/95 dark:bg-primary-800/95 backdrop-blur-sm shadow-md overflow-hidden transition-max-height duration-300 ease-in-out`;
  dropdown.style.maxHeight = "0";
  dropdown.style.zIndex = "40";

  const nav = navUl.cloneNode(true);
  nav.className = "flex flex-col items-center py-4 space-y-2";
  nav
    .querySelectorAll("a")
    .forEach((a) =>
      a.classList.add(
        "block",
        "py-2",
        "px-4",
        "rounded",
        "hover:bg-gray-100",
        "dark:hover:bg-primary-700",
      ),
    );
  dropdown.appendChild(nav);

  document
    .querySelector("header nav")
    ?.insertAdjacentElement("afterend", dropdown);

  burgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.maxHeight !== "0px";
    dropdown.style.maxHeight = isOpen ? "0" : `${nav.scrollHeight}px`;
  });

  document.addEventListener("click", (e) => {
    if (
      !dropdown.contains(e.target) &&
      !burgerBtn.contains(e.target) &&
      dropdown.style.maxHeight !== "0px"
    ) {
      dropdown.style.maxHeight = "0";
    }
  });
}

/**
 * Initializes the main page by fetching latest articles and rendering highlight cards.
 */
async function initializePage() {
  console.log("Initializing main page...");
  try {
    const articlePromises = CATEGORIES.map(fetchLatestArticle);
    const articles = await Promise.all(articlePromises);
    CATEGORIES.forEach((category, index) => {
      updateHighlightCard(category, articles[index]);
    });
    console.log("Highlight cards updated.");
  } catch (error) {
    console.error("Error during page initialization:", error);
    // Handle error display if needed
  }
}

// --- Global Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  createMobileMenu();
  initializePage();

  languageBtn?.addEventListener("click", () => {
    console.log("Language toggle clicked - Functionality not implemented.");
    alert("Language switching is not yet implemented.");
  });
});

// --- Exports (Optional) ---
// No exports needed currently
