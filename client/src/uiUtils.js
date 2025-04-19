// client/src/uiUtils.js
import { t, currentLang, setLanguage } from "./i18n.js";
console.log("--- uiUtils.js STARTING TO EXECUTE ---");

// --- Header HTML Template ---
const headerHTML = `
<header>
  <nav
    class="dark:bg-primary-800/80 fixed flex w-screen items-center justify-between bg-white/80 px-2 backdrop-blur-sm z-50"
  >
    <a href="index.html" class="flex-shrink-0">
        <i class="cursor-pointer text-xl transition-colors duration-200 select-none hover:text-blue-500">
          MSKTF
        </i>
     </a>

    <ul class="hidden md:flex md:items-center md:justify-center flex-grow">
      <li class="comp-navlink"><a href="index.html" data-i18n="navHome">Home</a></li>
      <li class="comp-navlink"><a href="competitions.html" data-i18n="navCompetitions">Competitions</a></li>
      <li class="comp-navlink"><a href="articles.html" data-i18n="navNewsBlog">News & Blog</a></li>
      <li class="comp-navlink"><a href="mission.html" data-i18n="navMission">Mission</a></li>
      <li class="comp-navlink"><a href="contact.html" data-i18n="navContact">Contact</a></li>
    </ul>

    <div class="flex items-center flex-shrink-0">
        <div class="relative hidden md:block mr-2">
            <button
              class="flex items-center rounded p-1 transition-colors duration-200 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
              id="language-btn"
              aria-label="Select Language"
            >
               <span id="current-lang-display" class="text-xs mr-1">EN</span>
               <i class="fi fi-rr-globe"></i>
            </button>
            <div id="language-dropdown" class="absolute right-0 top-full mt-1 hidden w-32 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-700 z-50">
               <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="language-btn">
                 <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem" data-lang="en">English</a>
                 <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem" data-lang="rus">Русский</a>
                 <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem" data-lang="mng">Монгол</a>
               </div>
             </div>
        </div>
        <button id="burger-btn" class="md:hidden" aria-label="Toggle Menu">
          <i class="fi fi-br-menu-burger transition-colors duration-200 hover:text-blue-500 text-lg leading-none"></i>
        </button>
    </div>
  </nav>
</header>
`;

// --- Footer HTML Template ---
const footerHTML = `
<footer class="mt-8 p-4 text-center bg-primary-500 text-white dark:bg-white dark:text-black">
  <p data-i18n="footerCopyright">
    Copyrights © {year} Mongolian Sports Knife Throwing Federation
  </p>
</footer>
`;

/** Injects the header HTML into the #header-placeholder element. */
function loadHeader() {
  const placeholder = document.getElementById("header-placeholder");
  if (placeholder) {
    placeholder.innerHTML = headerHTML;
  } else {
    console.error(
      "[uiUtils] #header-placeholder element not found in the HTML.",
    );
  }
}

/** Injects the footer HTML into the #footer-placeholder element. */
function loadFooter() {
  const placeholder = document.getElementById("footer-placeholder");
  if (placeholder) {
    placeholder.innerHTML = footerHTML;
  } else {
    console.error(
      "[uiUtils] #footer-placeholder element not found in the HTML.",
    );
  }
}

/** Creates the mobile menu and sets up its toggle behavior. */
function createMobileMenu() {
  const burgerBtn = document.getElementById("burger-btn");
  if (!burgerBtn) return;
  const navContainer = document.querySelector("#header-placeholder header nav");
  const navUl = navContainer?.querySelector("ul");
  if (!navUl) {
    console.warn("[uiUtils] Could not find 'header nav ul' after header load.");
    return;
  }

  let dropdown = document.getElementById("mobile-menu");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "mobile-menu";
    // --- Updated Classes for the dropdown container ---
    dropdown.className = `
      md:hidden fixed top-10 left-0 right-0 w-full   /* << CHANGED top-11 to top-10 */
      bg-white dark:bg-gray-800
      overflow-hidden transition-max-height duration-300 ease-in-out z-40`; // No border, no shadow
    // --- End Updated Classes ---
    dropdown.style.maxHeight = "0";

    const nav = navUl.cloneNode(true);
    // Use the same classes for UL and A as in the previous step
    nav.className = "flex flex-col py-4 space-y-1";
    nav
      .querySelectorAll("a")
      .forEach((a) =>
        a.classList.add(
          "block",
          "py-3",
          "px-4",
          "rounded-md",
          "text-gray-700",
          "dark:text-gray-200",
          "hover:bg-gray-100",
          "dark:hover:bg-gray-700",
          "focus:outline-none",
          "focus:ring-2",
          "focus:ring-blue-500",
          "dark:focus:ring-blue-400",
          "focus:bg-gray-100",
          "dark:focus:bg-gray-700",
          "text-left",
        ),
      );
    // --- End A classes ---

    dropdown.appendChild(nav);
    navContainer?.insertAdjacentElement("afterend", dropdown);
  } else {
    dropdown.style.maxHeight = "0";
  }

  // Toggle logic remains the same
  if (!burgerBtn.dataset.mobileMenuListener) {
    burgerBtn.dataset.mobileMenuListener = "true";
    burgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentDropdown = document.getElementById("mobile-menu");
      if (!currentDropdown) return;
      const isOpen = currentDropdown.style.maxHeight !== "0px";
      const innerNav = currentDropdown.querySelector("ul");
      currentDropdown.style.maxHeight = isOpen
        ? "0"
        : `${innerNav?.scrollHeight || 250}px`;
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
}

/** Sets up the language selector dropdown behavior. */
function setupLanguageSelectorListeners() {
  const languageBtn = document.getElementById("language-btn");
  const languageDropdown = document.getElementById("language-dropdown");

  if (!languageBtn || !languageDropdown) {
    console.warn(
      "[uiUtils] Language selector elements not found after header load.",
    );
    return;
  }

  const currentLangDisplay = document.getElementById("current-lang-display");
  if (currentLangDisplay) {
    currentLangDisplay.textContent = currentLang.toUpperCase();
  }

  if (!languageBtn.dataset.langMenuListener) {
    languageBtn.dataset.langMenuListener = "true";
    languageBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      languageDropdown.classList.toggle("hidden");
    });
    languageDropdown.addEventListener("click", (e) => {
      if (e.target.tagName === "A" && e.target.dataset.lang) {
        e.preventDefault();
        const selectedLang = e.target.dataset.lang;
        if (selectedLang !== currentLang) {
          setLanguage(selectedLang);
        }
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
  }
}

/** Translates static elements marked with data-i18n attribute. */
export function translateStaticElements() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (!key) return;
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
    if (key === "footerCopyright") {
      params.year = new Date().getFullYear();
    }
    const translation = t(key, params);
    if (element.hasAttribute("placeholder")) {
      element.placeholder = translation;
    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    } else if (
      key === "footerCopyright" ||
      element.closest("#pagination-controls")
    ) {
      element.innerHTML = translation;
    } else {
      element.textContent = translation;
    }
  });
}

/** Initializes common UI: Loads Header/Footer, Sets up Listeners, Translates. */
export function initializeUI() {
  loadHeader();
  loadFooter();
  // Run listeners after HTML is injected
  setupLanguageSelectorListeners();
  createMobileMenu();
  translateStaticElements();
}
