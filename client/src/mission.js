// client/src/mission.js
import "./style.css"; // Import base styles
import { t, currentLang, setLanguage, supportedLangs } from './i18n.js';

// --- DOM Elements ---
const languageBtn = document.getElementById("language-btn");
const languageDropdown = document.getElementById("language-dropdown");
const currentLangDisplay = document.getElementById("current-lang-display");
// Add other specific DOM elements for this page if needed

// --- Language Selector Logic ---
function setupLanguageSelector() {
  // ... (Keep the exact same logic as in main.js/articles.js) ...
   if (!languageBtn || !languageDropdown) { console.warn("Language selector elements not found on this page."); return; }
   if(currentLangDisplay) { currentLangDisplay.textContent = currentLang.toUpperCase(); }
   languageBtn.addEventListener('click', (e) => { e.stopPropagation(); languageDropdown.classList.toggle('hidden'); });
   languageDropdown.addEventListener('click', (e) => { if (e.target.tagName === 'A' && e.target.dataset.lang) { e.preventDefault(); setLanguage(e.target.dataset.lang); languageDropdown.classList.add('hidden'); } });
   document.addEventListener('click', (e) => { if (!languageBtn.contains(e.target) && !languageDropdown.contains(e.target)) { languageDropdown.classList.add('hidden'); } });
}

// --- Function to translate static elements ---
function translateStaticElements() {
  // ... (Keep the exact same logic as in main.js/articles.js) ...
   document.querySelectorAll('[data-i18n]').forEach(element => { /* ... translation logic ... */ 
      const key = element.getAttribute('data-i18n');
      const paramsAttr = element.getAttribute('data-i18n-params');
      let params = {};
      if (paramsAttr) { try { params = JSON.parse(paramsAttr); } catch (e) { console.error(`Error parsing i18n params for key "${key}":`, e); } }
      if (key === 'footerCopyright') { params.year = new Date().getFullYear(); }
      if (element.hasAttribute('placeholder')) { element.placeholder = t(key, params); } else { element.textContent = t(key, params); }
   });
   const navLinks = { /* ... navLinks mapping ... */ 
      'index.html': 'navHome',
      'competitions.html': 'navCompetitions',
      'articles.html': 'navNewsBlog', 
      'mission.html': 'navMission',
      'contact.html': 'navContact',
      'admin.html': 'navAdmin'
   };
   document.querySelectorAll('header nav a').forEach(link => { /* ... nav link translation ... */ 
      const href = link.getAttribute('href');
      const key = navLinks[href];
      if (key) { link.textContent = t(key); }
   });
    const copyrightFooter = document.querySelector('footer p[data-i18n="footerCopyright"]');
    if (copyrightFooter) copyrightFooter.textContent = t('footerCopyright', { year: new Date().getFullYear() });

    // Translate list items if using data-i18n-list approach (example)
    const valuesList = document.querySelector('[data-i18n-list="valuesList"]');
    if (valuesList) {
        valuesList.querySelectorAll('li').forEach(item => {
            const key = item.getAttribute('data-i18n');
            if (key) {
                item.textContent = t(key);
            }
        });
    }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  setupLanguageSelector();
  translateStaticElements();
  // No dynamic data fetching needed for mission page (yet)
});
