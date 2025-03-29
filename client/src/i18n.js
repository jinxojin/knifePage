// client/src/i18n.js

// Import locale data directly using Vite's JSON import capability
import enTranslations from './locales/en.json';
import rusTranslations from './locales/rus.json';
import mngTranslations from './locales/mng.json';

const translations = {
  en: enTranslations,
  rus: rusTranslations,
  mng: mngTranslations,
};

const supportedLangs = ['en', 'rus', 'mng'];
let currentLang = localStorage.getItem('selectedLang') || 'en'; // Default to English

// Validate stored language
if (!supportedLangs.includes(currentLang)) {
  currentLang = 'en';
  localStorage.setItem('selectedLang', currentLang); // Correct invalid stored value
}

/**
 * Gets the translation for a given key in the current language.
 * Supports simple interpolation for placeholders like {key}.
 * @param {string} key - The translation key (e.g., "navHome").
 * @param {object} [params={}] - Optional parameters for interpolation.
 * @returns {string} The translated string or the key itself if not found.
 */
function t(key, params = {}) {
  let translation = translations[currentLang]?.[key] || translations['en']?.[key] || key; // Fallback to English, then key

  // Simple interpolation
  for (const paramKey in params) {
    translation = translation.replace(`{${paramKey}}`, params[paramKey]);
  }

  return translation;
}

/**
 * Sets the current language and stores it in localStorage.
 * NOTE: This function currently requires a page reload to apply changes globally
 * because translations are applied on initial load.
 * @param {string} langCode - The language code ('en', 'rus', 'mng').
 */
function setLanguage(langCode) {
  if (supportedLangs.includes(langCode) && langCode !== currentLang) {
    currentLang = langCode;
    localStorage.setItem('selectedLang', currentLang);
    window.location.reload(); // Reload to apply changes everywhere
  }
}

// Export the translation function and current language
export { t, currentLang, setLanguage, supportedLangs };
