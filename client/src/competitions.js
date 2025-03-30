// client/src/competitions.js
import "./style.css"; // Import base styles
import { t, currentLang, setLanguage } from "./i18n.js";
// Import functions from articles.js
import { renderArticle, getArticlesByCategory } from "./articles.js";
// Import date formatting utils if needed by renderArticle or here
// import { getConditionalTimestampStrings } from './articles.js'; // Example

// --- DOM Elements ---
const languageBtn = document.getElementById("language-btn");
const languageDropdown = document.getElementById("language-dropdown");
const competitionContentContainer = document.getElementById(
  "competition-content",
);

// --- Language Selector Logic ---
function setupLanguageSelector() {
  if (!languageBtn || !languageDropdown) {
    console.warn("Language selector elements not found on this page.");
    return;
  }
  const currentLangDisplay = document.getElementById("current-lang-display");
  if (currentLangDisplay) {
    currentLangDisplay.textContent = currentLang.toUpperCase();
  }
  languageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    languageDropdown.classList.toggle("hidden");
  });
  languageDropdown.addEventListener("click", (e) => {
    if (e.target.tagName === "A" && e.target.dataset.lang) {
      e.preventDefault();
      setLanguage(e.target.dataset.lang);
      languageDropdown.classList.add("hidden");
    }
  });
  document.addEventListener("click", (e) => {
    if (
      !languageBtn.contains(e.target) &&
      !languageDropdown.contains(e.target)
    ) {
      languageDropdown.classList.add("hidden");
    }
  });

  // Add mobile menu logic
  const burgerBtn = document.getElementById("burger-btn");
  if (burgerBtn) {
    createMobileMenu();
  }
}

// --- Mobile Menu Logic (Consistent across pages) ---
function createMobileMenu() {
  const burgerBtn = document.getElementById("burger-btn");
  if (!burgerBtn) return;
  const navUl = document.querySelector("header nav ul");
  if (!navUl) return;
  let dropdown = document.getElementById("mobile-menu");

  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "mobile-menu";
    dropdown.className = `md:hidden fixed top-14 left-0 right-0 w-full bg-white/95 dark:bg-primary-800/95 backdrop-blur-sm shadow-md overflow-hidden transition-max-height duration-300 ease-in-out z-40`;
    dropdown.style.maxHeight = "0";

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
          "w-full",
          "text-center",
        ),
      );
    dropdown.appendChild(nav);
    document
      .querySelector("header nav")
      ?.insertAdjacentElement("afterend", dropdown);
  } else {
    dropdown.style.maxHeight = "0";
  }

  burgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const currentDropdown = document.getElementById("mobile-menu");
    if (!currentDropdown) return;
    const isOpen = currentDropdown.style.maxHeight !== "0px";
    const innerNav = currentDropdown.querySelector("ul");
    currentDropdown.style.maxHeight = isOpen
      ? "0"
      : `${innerNav?.scrollHeight || 200}px`;
  });

  document.addEventListener("click", (e) => {
    const mobileMenu = document.getElementById("mobile-menu");
    if (
      mobileMenu &&
      !mobileMenu.contains(e.target) &&
      !burgerBtn.contains(e.target) &&
      mobileMenu.style.maxHeight !== "0px"
    ) {
      mobileMenu.style.maxHeight = "0";
    }
  });
}

// --- Function to translate static elements ---
function translateStaticElements() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const paramsAttr = element.getAttribute("data-i18n-params");
    let params = {};
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.error(`Error parsing i18n params for key "${key}":`, e);
      }
    }
    if (key === "footerCopyright") {
      params.year = new Date().getFullYear();
    }

    if (element.hasAttribute("placeholder")) {
      element.placeholder = t(key, params);
    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    } else {
      if (key === "footerCopyright") {
        element.innerHTML = t(key, params);
      } else {
        element.textContent = t(key, params);
      }
    }
  });
  // Nav links are handled by data-i18n attributes in HTML
}

// --- Competition Fetching/Rendering Logic ---
async function loadCompetitionData() {
  if (!competitionContentContainer) {
    console.error("Competition content container not found!");
    return;
  }
  // Set loading text using translation immediately
  competitionContentContainer.innerHTML = `<p class="text-center py-10">${t("loadingCompetitionDetails")}</p>`;

  try {
    // Fetch latest 'competition' category article, limit 1
    const articles = await getArticlesByCategory("competition", currentLang, 1);

    if (articles && articles.length > 0) {
      const competitionArticle = articles[0]; // Get the first (latest) article
      document.title = `${competitionArticle.title || t("competitionsTitle")} - MSKTF`; // Update page title

      // Use the renderArticle function from articles.js to display the content
      renderArticle(competitionArticle, competitionContentContainer);
    } else {
      // Set 'no data' text using translation
      competitionContentContainer.innerHTML = `<p class="text-center py-10">${t("noCompetitionData")}</p>`;
      document.title = `${t("competitionsTitle")} - MSKTF`; // Reset title
    }
  } catch (error) {
    console.error("Error loading competition data:", error);
    // Set error text using translation
    competitionContentContainer.innerHTML = `<p class="text-center text-red-500 py-10">${t("errorLoadingData")}: ${error.message || ""}</p>`;
    document.title = `${t("competitionsTitle")} - MSKTF`; // Reset title
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  setupLanguageSelector();
  translateStaticElements(); // Translate static parts first
  loadCompetitionData(); // Then load dynamic data
});
