// client/src/uiUtils.js
import { t, currentLang, setLanguage } from "./i18n.js";
console.log("--- uiUtils.js STARTING TO EXECUTE ---");

// --- Header HTML Template ---
const headerHTML = `
<header>
  <nav
    class="fixed z-50 flex w-screen items-center justify-between bg-white/80 px-4 backdrop-blur-sm dark:bg-primary-800/80 h-16"
  >
    <a href="index.html" class="flex-shrink-0 text-xl font-semibold text-black transition-colors duration-200 hover:text-blue-500 dark:text-white dark:hover:text-blue-400">
        MSKTF
    </a>

    <ul class="hidden md:flex md:items-center md:justify-center flex-grow">
      <li class="comp-navlink"><a href="index.html" data-i18n="navHome" class="text-black hover:text-blue-500 dark:text-white dark:hover:text-blue-400">Home</a></li>
      <li class="comp-navlink"><a href="competitions.html" data-i18n="navCompetitions" class="text-black hover:text-blue-500 dark:text-white dark:hover:text-blue-400">Competitions</a></li>
      <li class="comp-navlink"><a href="articles.html" data-i18n="navNewsBlog" class="text-black hover:text-blue-500 dark:text-white dark:hover:text-blue-400">News & Blog</a></li>
      <li class="comp-navlink"><a href="mission.html" data-i18n="navMission" class="text-black hover:text-blue-500 dark:text-white dark:hover:text-blue-400">Mission</a></li>
    </ul>

    <div class="flex items-center flex-shrink-0 space-x-4">
        <div class="relative hidden md:block">
            <button
              class="flex items-center rounded p-1 text-black transition-colors duration-200 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:text-white dark:hover:text-blue-400"
              id="language-btn"
              aria-label="Select Language"
            >
               <i class="fi fi-rr-globe text-base"></i>
            </button>
            <div id="language-dropdown" class="absolute right-0 top-full mt-1 hidden w-32 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-700 z-50">
               <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="language-btn">
                 <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem" data-lang="en">English</a>
                 <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem" data-lang="rus">Русский</a>
                 <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem" data-lang="mng">Монгол</a>
               </div>
             </div>
        </div>
        <button id="burger-btn" class="md:hidden p-1" aria-label="Toggle Menu">
          <i class="fi fi-br-menu-burger text-xl leading-none text-black transition-colors duration-200 hover:text-blue-500 dark:text-white dark:hover:text-blue-400"></i>
        </button>
    </div>
  </nav>
</header>
`;

// --- Footer HTML Template ---
const footerHTML = `
<footer id="site-footer" class="mt-12 border-t border-gray-300 bg-primary-700 px-4 pt-10 pb-6 text-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
  <div class="mx-auto max-w-screen-xl">
    <div class="grid gap-10 md:grid-cols-3 mb-8">

      <div>
        <h4 class="mb-4 text-lg font-semibold uppercase tracking-wider text-white dark:text-gray-200" data-i18n="footerLinks">Quick Links</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="index.html" data-i18n="navHome" class="hover:text-white dark:hover:text-gray-100">Home</a></li>
          <li><a href="competitions.html" data-i18n="navCompetitions" class="hover:text-white dark:hover:text-gray-100">Competitions</a></li>
          <li><a href="articles.html" data-i18n="navNewsBlog" class="hover:text-white dark:hover:text-gray-100">News & Blog</a></li>
          <li><a href="mission.html" data-i18n="navMission" class="hover:text-white dark:hover:text-gray-100">Mission</a></li>
        </ul>
      </div>

      <div>
        <h4 class="mb-4 text-lg font-semibold uppercase tracking-wider text-white dark:text-gray-200" data-i18n="footerContact">Contact Us</h4>
        <div class="space-y-2 text-sm">
          <p>
            <span class="font-medium text-white dark:text-gray-200"><i class="fi fi-rr-envelope"></i></span>
            <a href="mailto:monknifethrowing@gmail.com" class="hover:text-white dark:hover:text-gray-100 ml-1">
              monknifethrowing@gmail.com
            </a>
          </p>
          <p>
            <span class="font-medium text-white dark:text-gray-200"><i class="fi fi-rr-phone-call"></i></span>
            <a href="tel:+97699371250" class="hover:text-white dark:hover:text-gray-100 ml-1">
              +976 9937 1250
            </a>
            <a href="tel:+97699101102" class="hover:text-white dark:hover:text-gray-100 ml-1">
              +976 9910 1102
            </a>
          </p>
          <p>
            <span class="font-medium text-white dark:text-gray-200"><i class="fi fi-rr-marker"></i></span>
            <span class="ml-1">
              <a data-i18n="footerAddressText" href="https://www.google.com/maps/place/%D0%A2%D2%AF%D1%88%D0%B8%D0%B3+%D1%82%D3%A9%D0%B2/@47.9137041,106.9023233,17z/data=!3m1!4b1!4m6!3m5!1s0x5d969251a5016c17:0xa0c9111c2b427dab!8m2!3d47.9137005!4d106.9048982!16s%2Fg%2F11c5h2zn95?entry=ttu&g_ep=EgoyMDI1MDQyMS4wIKXMDSoJLDEwMjExNjQwSAFQAw%3D%3D" class="hover:text-white dark:hover:text-gray-100">
              #501, 5th floor, Tushig center, Seoul street-23, Sukhbaatar district, Ulaanbaatar, Mongolia
              </a>
            </span>
          </p>
        </div>
      </div>

      <div>
         <h4 class="mb-4 text-lg font-semibold uppercase tracking-wider text-white dark:text-gray-200">Follow Us</h4>
         <div class="flex justify-center space-x-4">
           <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="text-primary-100 hover:text-white dark:text-gray-400 dark:hover:text-gray-100">
             <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clip-rule="evenodd" /></svg>
           </a>
           <a href="#" target="_blank" rel="noopener noreferrer" aria-label="YouTube" class="text-primary-100 hover:text-white dark:text-gray-400 dark:hover:text-gray-100">
             <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.78 22 12 22 12s0 3.22-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.594.418-7.814.418-7.814.418s-6.22 0-7.814-.418a2.505 2.505 0 0 1-1.768-1.768C2 15.22 2 12 2 12s0-3.22.418-4.814a2.505 2.505 0 0 1 1.768-1.768C5.78 5 12 5 12 5s6.22 0 7.812.418zM9.999 15.199l4.94-3.2L9.999 8.798v6.4z" clip-rule="evenodd" /></svg>
           </a>
         </div>
      </div>

    </div>

    <div class="mt-8 border-t border-primary-600 pt-6 text-center dark:border-gray-700">
      <p data-i18n="footerCopyright">
        Copyrights © {year} Mongolian Sports Knife Throwing Federation
      </p>
    </div>
  </div>
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
    dropdown.className = `md:hidden fixed top-16 left-0 right-0 w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden transition-max-height duration-300 ease-in-out z-40`;
    dropdown.style.maxHeight = "0";

    const nav = navUl.cloneNode(true); // Clone the main nav links
    nav.className = "flex flex-col py-3 space-y-1";
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
    dropdown.appendChild(nav);

    // --- Add Language Switcher to Mobile Menu ---
    const desktopLangContainer =
      navContainer?.querySelector("#language-btn")?.parentElement;
    if (desktopLangContainer) {
      const mobileLangContainer = document.createElement("div"); // Create a simple div container
      mobileLangContainer.className = "relative px-4"; // Add horizontal padding like nav links, relative for dropdown positioning

      const mobileLangButton = desktopLangContainer
        .querySelector("button")
        .cloneNode(true);
      const mobileLangDropdown = desktopLangContainer
        .querySelector("#language-dropdown")
        .cloneNode(true);

      if (mobileLangButton && mobileLangDropdown) {
        mobileLangButton.id = "language-btn-mobile";
        mobileLangDropdown.id = "language-dropdown-mobile";
        mobileLangDropdown.setAttribute(
          "aria-labelledby",
          "language-btn-mobile",
        );

        // Style button to look like a nav link
        mobileLangButton.className =
          "flex items-center w-full py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-gray-100 dark:focus:bg-gray-700 rounded-md";
        mobileLangButton.innerHTML = `
          <i class="fi fi-rr-globe text-base mr-2 inline-block align-middle"></i>
          <span class="inline-block align-middle">Language</span>
          <span id="current-lang-display-mobile" class="ml-auto pl-2 text-xs uppercase text-gray-500 dark:text-gray-400 inline-block align-middle">${currentLang.toUpperCase()}</span>
        `;

        // Style dropdown - relative to mobile container
        mobileLangDropdown.className =
          "relative hidden w-full mt-1 rounded-md bg-gray-50 dark:bg-gray-700 z-10";

        // Style dropdown links for better padding inside mobile menu
        mobileLangDropdown.querySelectorAll("a").forEach((a) => {
          a.classList.remove("px-4");
          a.classList.add("py-3", "pl-8", "pr-4");
        });

        mobileLangContainer.appendChild(mobileLangButton);
        mobileLangContainer.appendChild(mobileLangDropdown);

        const separator = document.createElement("div");
        separator.className =
          "border-t border-gray-200 dark:border-gray-600 mx-4 my-2";
        dropdown.appendChild(separator);

        dropdown.appendChild(mobileLangContainer);
      }
    }
    // --- End Language Switcher Add ---

    navContainer?.insertAdjacentElement("afterend", dropdown);
  } else {
    dropdown.style.maxHeight = "0";
  }

  // --- Toggle logic for main mobile menu ---
  if (!burgerBtn.dataset.mobileMenuListener) {
    burgerBtn.dataset.mobileMenuListener = "true";
    burgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentDropdown = document.getElementById("mobile-menu");
      const mobileLangDropdown = document.getElementById(
        "language-dropdown-mobile",
      );
      if (!currentDropdown) return;
      const isOpen = currentDropdown.style.maxHeight !== "0px";

      if (isOpen) {
        if (mobileLangDropdown) mobileLangDropdown.classList.add("hidden");
        currentDropdown.style.maxHeight = "0";
      } else {
        if (mobileLangDropdown) mobileLangDropdown.classList.add("hidden");
        currentDropdown.style.display = "block";
        currentDropdown.style.maxHeight = `${currentDropdown.scrollHeight}px`;
        currentDropdown.style.removeProperty("display");
      }
    });
  }
  // Close main menu if clicking outside
  document.addEventListener("click", (e) => {
    const mobileMenu = document.getElementById("mobile-menu");
    const mobileLangDropdown = document.getElementById(
      "language-dropdown-mobile",
    );
    if (
      mobileMenu &&
      !mobileMenu.contains(e.target) &&
      !burgerBtn.contains(e.target) &&
      mobileMenu.style.maxHeight !== "0px"
    ) {
      if (mobileLangDropdown) mobileLangDropdown.classList.add("hidden");
      mobileMenu.style.maxHeight = "0";
    }
  });
}

/** Sets up the language selector dropdown behavior. */
function setupLanguageSelectorListeners() {
  // Function to setup listeners for a specific switcher instance
  const setupSwitcher = (buttonId, dropdownId, displayId) => {
    const languageBtn = document.getElementById(buttonId);
    const languageDropdown = document.getElementById(dropdownId);
    const currentLangDisplay = document.getElementById(displayId);
    const mobileMenu = document.getElementById("mobile-menu"); // Get main mobile menu

    if (!languageBtn || !languageDropdown) {
      return;
    }
    if (currentLangDisplay) {
      currentLangDisplay.textContent = currentLang.toUpperCase();
    }

    const listenerAttribute = `data-${buttonId}-listener`;
    if (!languageBtn.hasAttribute(listenerAttribute)) {
      languageBtn.setAttribute(listenerAttribute, "true");

      languageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = languageDropdown.classList.toggle("hidden");

        // Recalculate mobile menu height IF this is the mobile button
        if (
          buttonId === "language-btn-mobile" &&
          mobileMenu &&
          mobileMenu.style.maxHeight !== "0px"
        ) {
          setTimeout(() => {
            mobileMenu.style.maxHeight = `${mobileMenu.scrollHeight}px`;
          }, 50); // Small delay
        }
      });

      languageDropdown.addEventListener("click", (e) => {
        if (e.target.tagName === "A" && e.target.dataset.lang) {
          e.preventDefault();
          const selectedLang = e.target.dataset.lang;
          if (currentLangDisplay) {
            currentLangDisplay.textContent = selectedLang.toUpperCase();
          }
          if (selectedLang !== currentLang) {
            setLanguage(selectedLang);
          }
          // Page reload handles closing
        }
      });
    }
  };

  // Setup for Desktop
  setupSwitcher("language-btn", "language-dropdown", null);

  // Setup for Mobile
  setupSwitcher(
    "language-btn-mobile",
    "language-dropdown-mobile",
    "current-lang-display-mobile",
  );

  // Global listener to close dropdowns
  document.addEventListener("click", (e) => {
    const desktopBtn = document.getElementById("language-btn");
    const desktopDropdown = document.getElementById("language-dropdown");
    const mobileBtn = document.getElementById("language-btn-mobile");
    const mobileDropdown = document.getElementById("language-dropdown-mobile");
    const mobileMenu = document.getElementById("mobile-menu");

    // Close desktop
    if (
      desktopBtn &&
      desktopDropdown &&
      !desktopBtn.contains(e.target) &&
      !desktopDropdown.contains(e.target)
    ) {
      desktopDropdown.classList.add("hidden");
    }
    // Close mobile language dropdown
    if (
      mobileBtn &&
      mobileDropdown &&
      !mobileBtn.contains(e.target) &&
      !mobileDropdown.contains(e.target)
    ) {
      if (!mobileDropdown.classList.contains("hidden")) {
        mobileDropdown.classList.add("hidden");
        // Recalculate main menu height when language dropdown closes
        if (mobileMenu && mobileMenu.style.maxHeight !== "0px") {
          setTimeout(() => {
            mobileMenu.style.maxHeight = `${mobileMenu.scrollHeight}px`;
          }, 50);
        }
      }
    }
    // Main mobile menu closing is handled by its own separate listener
  });
}

/** Translates static elements marked with data-i18n attribute. */
function translateStaticElements() {
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
    const isInput =
      element.tagName === "INPUT" || element.tagName === "TEXTAREA";
    const isPlaceholder = element.hasAttribute("placeholder");
    const isValue = element.hasAttribute("value") && isInput;

    if (key === "federationSlogan") {
      element.innerHTML = translation;
    } else if (isPlaceholder) {
      element.placeholder = translation;
    } else if (isValue) {
      // Skip value
    } else if (element.tagName === "BUTTON" || element.closest("button")) {
      const textSpan = element.querySelector('span:not([id*="lang-display"])');
      if (textSpan) {
        textSpan.textContent = translation;
      } else {
        let textNode = Array.from(element.childNodes).find(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
        if (textNode) {
          textNode.textContent = translation;
        } else {
          element.textContent = translation;
        }
      }
    } else if (element.closest("#pagination-controls")) {
      element.innerHTML = translation;
    } else {
      element.textContent = translation;
    }
  });
}

/** Initializes common UI: Loads Header/Footer, Sets up Listeners, Translates. */
function initializeUI() {
  loadHeader();
  loadFooter();
  setTimeout(() => {
    try {
      createMobileMenu();
      setupLanguageSelectorListeners();
      translateStaticElements();
    } catch (error) {
      console.error("Error during deferred UI listener setup:", error);
    }
  }, 0);
}

// Keep only the single named export block at the end
export { initializeUI, translateStaticElements };
