// client/src/main.js
import "./style.css";

const API_URL = "http://localhost:3000/api";
const CATEGORIES = ["competition", "news", "blog"];

const burgerBtn = document.getElementById("burger-btn");
const languageBtn = document.getElementById("language-btn");

async function fetchLatestArticle(category) {
  try {
    console.log(`Fetching ${category} articles...`);
    const response = await fetch(
      `${API_URL}/articles/category/${category}?limit=1`,
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const articles = await response.json();
    console.log(`${category} articles received:`, articles);
    return articles[0] || null;
  } catch (error) {
    console.error(`Error fetching ${category} article:`, error);
    return null;
  }
}

function updateHighlightCard(category, article) {
  const container = document.getElementById(`highlight-${category}`);
  if (!container) return;

  if (!article) {
    container.innerHTML = `
                <div class="p-5">
                    <h5 class="mb-2 text-xl font-medium">No ${category} article found</h5>
                    <p class="mb-3 text-gray-700 dark:text-gray-400">Check back later for updates.</p>
                </div>
            `;
    return;
  }
  const excerpt = createArticleExcerpt(article.content, 150);

  container.innerHTML = `
            <a href="/article.html?id=${article.id}">
                <img class="rounded-t-lg" src="${
                  article.imageUrl || "./assets/comp-placeholder.jpg"
                }"
                     alt="${category} image" />
            </a>
            <div class="p-5">
                <a href="/article.html?id=${article.id}">
                    <h5 class="mb-2 text-xl font-medium tracking-tight text-gray-900 dark:text-white">
                        ${article.title}
                    </h5>
                </a>
                <p class="mb-3 font-normal text-gray-700 dark:text-gray-400">
                    ${excerpt}
                </p>
                <a href="/article.html?id=${article.id}"
                   class="bg-primary-700 dark:bg-primary-400 inline-flex items-center rounded-lg px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-900 focus:ring-4 focus:ring-blue-300 focus:outline-none dark:hover:bg-blue-900 dark:focus:ring-blue-800">
                    Read more
                    <svg class="ms-2 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true"
                         xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
                              stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                    </svg>
                </a>
            </div>
        `;
}

function createMobileMenu() {
  const dropdown = document.createElement("div");
  dropdown.id = "mobile-menu";
  dropdown.className =
    "fixed left-0 w-full overflow-hidden transition-[max-height] duration-300 bg-white/80 backdrop-blur-sm dark:bg-primary-800/80";
  dropdown.style.top = "32px";
  dropdown.style.maxHeight = "0";

  const nav = document.querySelector("nav ul").cloneNode(true);
  nav.className = "flex flex-col items-center py-4";
  dropdown.appendChild(nav);
  document.body.appendChild(dropdown);

  burgerBtn.addEventListener("click", () => {
    const isOpen = dropdown.style.maxHeight !== "0px";
    dropdown.style.maxHeight = isOpen ? "0" : "100vh";
    burgerBtn.querySelector("i").style.transform = isOpen
      ? "rotate(0deg)"
      : "rotate(90deg)";
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && !burgerBtn.contains(e.target)) {
      dropdown.style.maxHeight = "0";
      burgerBtn.querySelector("i").style.transform = "rotate(0deg)";
    }
  });
}

async function initializePage() {
  try {
    const articlePromises = CATEGORIES.map((category) =>
      fetchLatestArticle(category),
    );
    const articles = await Promise.all(articlePromises);

    CATEGORIES.forEach((category, index) => {
      updateHighlightCard(category, articles[index]);
    });
  } catch (error) {
    console.error("Error initializing page:", error);
    const errorContainer = document.getElementById("error-message");
    if (errorContainer) {
      errorContainer.textContent =
        "Failed to load featured articles. Please refresh the page.";
      errorContainer.classList.remove("hidden");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  createMobileMenu();
  initializePage();

  languageBtn?.addEventListener("click", () => {
    console.log("Language toggle clicked");
  });
});

export { fetchLatestArticle, updateHighlightCard, createArticleExcerpt };
import { createArticleExcerpt } from "./articles.js"; // Import
