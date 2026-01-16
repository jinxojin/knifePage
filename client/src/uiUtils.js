// client/src/uiUtils.js
import { t, currentLang, setLanguage } from "./i18n.js";
console.log("--- uiUtils.js STARTING TO EXECUTE ---");

// --- Header HTML Template ---
const headerHTML = `
<header>
  <nav
    class="fixed z-50 flex w-screen items-center justify-between bg-white/80 px-6 backdrop-blur-md dark:bg-primary-900/80 h-16 border-b border-gray-200/50 dark:border-gray-700/50 transition-all duration-300"
  >
    <a href="index.html" class="flex items-center text-2xl font-black tracking-tighter text-white transition-transform duration-200 hover:scale-105">
        <span class="bg-blue-600 px-3 py-1 rounded-lg shadow-sm shadow-blue-600/20">MSKTF</span>
    </a>

    <ul class="hidden md:flex md:items-center md:justify-center space-x-10 flex-grow text-[10px] font-bold uppercase tracking-widest">
      <li><a href="index.html" data-i18n="navHome" class="nav-link text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white transition-colors">Home</a></li>
      <li><a href="competitions.html" data-i18n="navCompetitions" class="nav-link text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white transition-colors">Competitions</a></li>
      <li><a href="articles.html" data-i18n="navNewsBlog" class="nav-link text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white transition-colors">News & Blog</a></li>
      <li><a href="mission.html" data-i18n="navMission" class="nav-link text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white transition-colors">Mission</a></li>
    </ul>

    <div class="flex items-center flex-shrink-0 space-x-4">
        <div class="relative hidden md:block">
            <button
              class="flex items-center justify-center px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white transition-all duration-200"
              id="language-btn"
              aria-label="Select Language"
            >
               <i class="fi fi-rr-globe mr-2 text-base"></i>
               <span data-i18n="navLanguage">Language</span>
               <i class="fi fi-rr-angle-small-down ml-1"></i>
            </button>
            <div id="language-dropdown" class="absolute right-0 top-full mt-2 hidden w-40 rounded-xl bg-white/90 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:bg-gray-800/90 z-50 overflow-hidden border border-gray-200 dark:border-gray-700">
               <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="language-btn">
                 <a href="#" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-900/30 transition-colors" role="menuitem" data-lang="en">
                    <span class="mr-3">🇺🇸</span> English
                 </a>
                 <a href="#" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-900/30 transition-colors" role="menuitem" data-lang="rus">
                    <span class="mr-3">🇷🇺</span> Русский
                 </a>
                 <a href="#" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-900/30 transition-colors" role="menuitem" data-lang="mng">
                    <span class="mr-3">🇲🇳</span> Монгол
                 </a>
               </div>
             </div>
        </div>
        <button id="burger-btn" class="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle Menu">
          <i class="fi fi-br-menu-burger text-xl leading-none text-gray-900 dark:text-white"></i>
        </button>
    </div>
  </nav>
</header>
`;

// --- Footer HTML Template ---
const footerHTML = `
<footer id="site-footer" class="mt-24 bg-gray-900 text-gray-300 dark:bg-black py-16 px-6 border-t border-white/5">
  <div class="container mx-auto max-w-5xl text-center">
    <!-- Footer Brand (Logo) -->
    <div class="mb-16 border-b border-white/5 pb-8 flex justify-center">
      <a href="index.html" class="inline-block text-2xl font-black tracking-tighter text-white transition-transform duration-200 hover:scale-105">
          <span class="bg-blue-600 px-3 py-1 rounded-lg shadow-sm shadow-blue-600/20">MSKTF</span>
      </a>
    </div>

    <div class="grid gap-16 md:grid-cols-3 mb-16 text-center items-start">
      
      <!-- Column 1: Quick Links -->
      <div class="flex flex-col items-center space-y-8">
        <h4 class="text-[10px] font-bold uppercase tracking-widest text-white/50" data-i18n="footerLinks">Quick Links</h4>
        <ul class="space-y-4 text-sm font-semibold text-center">
          <li><a href="index.html" class="hover:text-blue-500 transition-colors">Home</a></li>
          <li><a href="competitions.html" class="hover:text-blue-500 transition-colors">Competitions</a></li>
          <li><a href="articles.html" class="hover:text-blue-500 transition-colors">News & Blog</a></li>
          <li><a href="mission.html" class="hover:text-blue-500 transition-colors">Mission</a></li>
        </ul>
      </div>

      <!-- Column 2: Contact -->
      <div class="flex flex-col items-center space-y-8">
        <h4 class="text-[10px] font-bold uppercase tracking-widest text-white/50" data-i18n="footerContact">Contact Us</h4>
        <div class="space-y-4 text-sm font-semibold flex flex-col items-center">
          <div class="flex flex-col items-center group">
            <i class="fi fi-rr-envelope mb-2 text-blue-500 text-lg"></i>
            <a href="mailto:monknifethrowing@gmail.com" class="hover:text-white transition-colors">monknifethrowing@gmail.com</a>
          </div>
          <div class="flex flex-col items-center group">
            <i class="fi fi-rr-phone-call mb-2 text-blue-500 text-lg"></i>
            <div class="flex flex-col items-center space-y-1">
              <a href="tel:+97699371250" class="hover:text-white transition-colors">+976 9937 1250</a>
              <a href="tel:+97699101102" class="hover:text-white transition-colors">+976 9910 1102</a>
            </div>
          </div>
          <div class="flex flex-col items-center group">
            <i class="fi fi-rr-marker mb-2 text-blue-500 text-lg"></i>
            <a data-i18n="footerAddressText" href="https://www.google.com/maps/place/%D0%A2%D2%AF%D1%88%D0%B8%D0%B3+%D1%82%D3%A9%D0%B2/@47.9137041,106.9023233,17z/data=!3m1!4b1!4m6!3m5!1s0x5d969251a5016c17:0xa0c9111c2b427dab!8m2!3d47.9137005!4d106.9048982!16s%2Fg%2F11c5h2zn95?entry=ttu&g_ep=EgoyMDI1MDQyMS4wIKXMDSoJLDEwMjExNjQwSAFQAw%3D%3D" target="_blank" rel="noopener noreferrer" class="leading-relaxed hover:text-white transition-colors max-w-xs block">
              #501, 5th floor, Tushig center, Seoul street-23, Sukhbaatar district, Ulaanbaatar, Mongolia
            </a>
          </div>
        </div>
      </div>

      <!-- Column 3: Socials & Mission -->
      <div class="flex flex-col items-center space-y-8">
        <h4 class="text-[10px] font-bold uppercase tracking-widest text-white/50">Our Mission</h4>
        <p class="text-sm leading-relaxed text-gray-400 max-w-xs mx-auto">
          Promoting precision, traditional Mongolian values, and competitive excellence in the sport of knife throwing.
        </p>
        <div class="flex justify-center space-x-6 pt-2">
           <a href="https://www.facebook.com/profile.php?id=61567718350379" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-blue-500 transition-all duration-300 transform hover:scale-110">
             <svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
           </a>
           <a href="https://www.youtube.com/@ErdenebilegGanbold-u7m" target="_blank" rel="noopener noreferrer" class="text-gray-500 hover:text-red-600 transition-all duration-300 transform hover:scale-110">
             <svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.78 22 12 22 12s0 3.22-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.594.418-7.814.418-7.814.418s-6.22 0-7.814-.418a2.505 2.505 0 0 1-1.768-1.768C2 15.22 2 12 2 12s0-3.22.418-4.814a2.505 2.505 0 0 1 1.768-1.768C5.78 5 12 5 12 5s6.22 0 7.812.418zM9.999 15.199l4.94-3.2L9.999 8.798v6.4z"/></svg>
           </a>
        </div>
      </div>

    </div>

    <div class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-[10px] font-bold uppercase tracking-widest text-gray-600">
      <p data-i18n="footerCopyright">© {year} MSKTF Federation</p>
      <div class="flex space-x-8">
        <a href="#" class="hover:text-gray-400 transition-colors">Privacy</a>
        <a href="#" class="hover:text-gray-400 transition-colors">Terms</a>
      </div>
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
    nav.className = "flex flex-col py-3 space-y-1 text-center";
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
        ),
      );
    dropdown.appendChild(nav);

    // --- Add Language Switcher to Mobile Menu ---
    const desktopLangContainer =
      navContainer?.querySelector("#language-btn")?.parentElement;
    if (desktopLangContainer) {
      const mobileLangContainer = document.createElement("div");
      mobileLangContainer.className = "relative px-4 pb-4";

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

        mobileLangButton.className =
          "flex items-center justify-center w-full py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-gray-100 dark:focus:bg-gray-700 rounded-md";
        mobileLangButton.innerHTML = `
          <i class="fi fi-rr-globe text-base mr-2"></i>
          <span>Language</span>
          <span id="current-lang-display-mobile" class="ml-2 text-[10px] uppercase font-bold text-gray-400">${currentLang.toUpperCase()}</span>
        `;

        mobileLangDropdown.className =
          "relative hidden w-full mt-1 rounded-md bg-gray-50 dark:bg-gray-700 z-10";

        mobileLangDropdown.querySelectorAll("a").forEach((a) => {
          a.classList.remove("px-4");
          a.classList.add("py-3", "text-center");
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
      if (!currentDropdown) return;
      const isOpen = currentDropdown.style.maxHeight !== "0px";

      if (isOpen) {
        currentDropdown.style.maxHeight = "0";
      } else {
        currentDropdown.style.display = "block";
        currentDropdown.style.maxHeight = `${currentDropdown.scrollHeight}px`;
        currentDropdown.style.removeProperty("display");
      }
    });
  }
  // Close main menu if clicking outside
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

/** Sets up the language selector dropdown behavior. */
function setupLanguageSelectorListeners() {
  const setupSwitcher = (buttonId, dropdownId, displayId) => {
    const languageBtn = document.getElementById(buttonId);
    const languageDropdown = document.getElementById(dropdownId);
    const currentLangDisplay = document.getElementById(displayId);
    const mobileMenu = document.getElementById("mobile-menu");

    if (!languageBtn || !languageDropdown) return;
    if (currentLangDisplay) currentLangDisplay.textContent = currentLang.toUpperCase();

    const listenerAttribute = `data-${buttonId}-listener`;
    if (!languageBtn.hasAttribute(listenerAttribute)) {
      languageBtn.setAttribute(listenerAttribute, "true");

      languageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        languageDropdown.classList.toggle("hidden");
        if (buttonId === "language-btn-mobile" && mobileMenu && mobileMenu.style.maxHeight !== "0px") {
          setTimeout(() => { mobileMenu.style.maxHeight = `${mobileMenu.scrollHeight}px`; }, 50);
        }
      });

      languageDropdown.addEventListener("click", (e) => {
        if (e.target.tagName === "A" && e.target.dataset.lang) {
          e.preventDefault();
          const selectedLang = e.target.dataset.lang;
          if (selectedLang !== currentLang) setLanguage(selectedLang);
        }
      });
    }
  };

  setupSwitcher("language-btn", "language-dropdown", null);
  setupSwitcher("language-btn-mobile", "language-dropdown-mobile", "current-lang-display-mobile");

  document.addEventListener("click", () => {
    const desktopDropdown = document.getElementById("language-dropdown");
    const mobileDropdown = document.getElementById("language-dropdown-mobile");
    if (desktopDropdown) desktopDropdown.classList.add("hidden");
    if (mobileDropdown) mobileDropdown.classList.add("hidden");
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
      try { params = JSON.parse(paramsAttr); } catch (e) { console.error(`Error parsing i18n params:`, e); }
    }
    if (key === "footerCopyright") params.year = new Date().getFullYear();
    const translation = t(key, params);
    
    if (key === "federationSlogan") {
      element.innerHTML = translation;
    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      if (element.hasAttribute("placeholder")) element.placeholder = translation;
    } else if (element.tagName === "BUTTON" || element.closest("button")) {
      const textSpan = element.querySelector('span:not([id*="lang-display"])');
      if (textSpan) textSpan.textContent = translation;
      else element.textContent = translation;
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

      const currentPath = window.location.pathname.split("/").pop() || "index.html";
      document.querySelectorAll(".nav-link").forEach((link) => {
        const linkPath = link.getAttribute("href").split("/").pop();
        if (linkPath === currentPath) {
          link.classList.add("text-blue-600", "dark:text-blue-400", "font-bold");
          link.classList.remove("text-gray-600", "dark:text-gray-400");
        }
      });
    } catch (error) {
      console.error("Error during deferred UI listener setup:", error);
    }
  }, 0);
}

export { initializeUI, translateStaticElements };
