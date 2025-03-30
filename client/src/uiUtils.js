// client/src/uiUtils.js
import { t, currentLang, setLanguage } from "./i18n.js";

/**
 * Creates the mobile menu and sets up its toggle behavior.
 * Assumes #burger-btn and header nav ul exist in the calling page's HTML.
 */
function createMobileMenu() {
  const burgerBtn = document.getElementById("burger-btn");
  if (!burgerBtn) return; // Don't run if no burger button
  const navUl = document.querySelector("header nav ul"); // Main desktop nav
  if (!navUl) {
    console.warn("Could not find 'header nav ul' for mobile menu.");
    return;
  }
  let dropdown = document.getElementById("mobile-menu"); // Check if already exists

  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "mobile-menu";
    // Consistent styling and positioning
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
    // Insert after the main nav container (usually header > nav)
    document
      .querySelector("header nav")
      ?.insertAdjacentElement("afterend", dropdown);
  } else {
    // Ensure it's hidden if it somehow exists already (e.g., back navigation)
    dropdown.style.maxHeight = "0";
  }

  // --- Event Listeners for Mobile Menu ---
  // Use a flag to prevent multiple listeners if this function is called more than once (though it shouldn't be needed with proper structure)
  if (!burgerBtn.dataset.mobileMenuListener) {
    burgerBtn.dataset.mobileMenuListener = "true"; // Mark as listener attached

    burgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Re-select dropdown inside listener to ensure it exists
      const currentDropdown = document.getElementById("mobile-menu");
      if (!currentDropdown) return;

      const isOpen = currentDropdown.style.maxHeight !== "0px";
      const innerNav = currentDropdown.querySelector("ul");
      // Calculate scrollHeight or use a fallback height
      currentDropdown.style.maxHeight = isOpen
        ? "0"
        : `${innerNav?.scrollHeight || 250}px`;
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
      const mobileMenu = document.getElementById("mobile-menu"); // Re-select
      // Check if the click target is the burger button or inside the mobile menu
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
}

/**
 * Sets up the language selector dropdown behavior.
 * Assumes #language-btn, #language-dropdown, #current-lang-display exist.
 * Also calls createMobileMenu internally.
 */
export function setupLanguageSelector() {
  const languageBtn = document.getElementById("language-btn");
  const languageDropdown = document.getElementById("language-dropdown");

  if (!languageBtn || !languageDropdown) {
    console.warn(
      "[uiUtils] Language selector elements (#language-btn or #language-dropdown) not found.",
    );
    // Still try to set up mobile menu if burger exists
    createMobileMenu();
    return;
  }

  const currentLangDisplay = document.getElementById("current-lang-display");
  if (currentLangDisplay) {
    currentLangDisplay.textContent = currentLang.toUpperCase();
  }

  // --- Event Listeners for Language Dropdown ---
  if (!languageBtn.dataset.langMenuListener) {
    languageBtn.dataset.langMenuListener = "true";

    // Toggle dropdown visibility
    languageBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      languageDropdown.classList.toggle("hidden");
    });

    // Handle language selection
    languageDropdown.addEventListener("click", (e) => {
      if (e.target.tagName === "A" && e.target.dataset.lang) {
        e.preventDefault();
        const selectedLang = e.target.dataset.lang;
        // Only reload if language actually changes
        if (selectedLang !== currentLang) {
          setLanguage(selectedLang); // Handles localStorage and reload
        }
        languageDropdown.classList.add("hidden"); // Hide dropdown
      }
    });

    // Hide dropdown if clicking outside
    document.addEventListener("click", (e) => {
      // Check if the click is outside both the button and the dropdown itself
      if (
        !languageBtn.contains(e.target) &&
        !languageDropdown.contains(e.target)
      ) {
        languageDropdown.classList.add("hidden");
      }
    });
  }

  // Set up mobile menu (called from here to ensure burger listener is attached)
  createMobileMenu();
}

/**
 * Translates static elements marked with data-i18n attribute.
 */
export function translateStaticElements() {
  // console.log('[uiUtils] Translating static elements...'); // Optional debug log
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (!key) return; // Skip if key is missing

    const paramsAttr = element.getAttribute("data-i18n-params");
    let params = {};
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.error(
          `[uiUtils] Error parsing i18n params for key "${key}":`,
          e,
        );
      }
    }

    // Special handling for dynamic params like year
    if (key === "footerCopyright") {
      params.year = new Date().getFullYear();
    }
    // Add more special cases if needed

    const translation = t(key, params); // Get translation

    // Apply translation based on element type
    if (element.hasAttribute("placeholder")) {
      element.placeholder = translation;
    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      // Avoid setting textContent for input/textarea unless it's placeholder
    } else if (
      key === "footerCopyright" ||
      element.closest("#pagination-controls")
    ) {
      // Allow HTML for specific elements (footer, pagination buttons)
      element.innerHTML = translation;
    } else {
      element.textContent = translation;
    }
  });
}
