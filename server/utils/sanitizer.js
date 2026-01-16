// server/utils/sanitizer.js
const sanitizeHtml = require("sanitize-html");

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "p",
    "strong",
    "em",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "a",
    "h1",
    "h2",
    "h3",
    "br",
    "span",
    "div",
  ]),
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "style", "width", "height", "class"],
    span: ["style", "class"],
    p: ["style", "class"],
    div: ["style", "class"],
    "*": ["class"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^left$/, /^center$/, /^right$/, /^justify$/],
      color: [
        /^#(?:[0-9a-fA-F]{3}){1,2}$/,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      "background-color": [
        /^#(?:[0-9a-fA-F]{3}){1,2}$/,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      float: [/^left$/, /^right$/],
      margin: [/^\d+px$/],
      "margin-left": [/^\d+px$/],
      "margin-right": [/^\d+px$/],
      "margin-top": [/^\d+px$/],
      "margin-bottom": [/^\d+px$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["data", "http", "https"] },
  selfClosing: ["img", "br", "hr"],
  allowComments: false,
};

/**
 * Sanitizes HTML content.
 * @param {string} html - The raw HTML string.
 * @returns {string} - The sanitized HTML string.
 */
function sanitize(html) {
  if (!html) return html;
  return sanitizeHtml(html, sanitizeOptions);
}

module.exports = {
  sanitize,
  sanitizeOptions,
};
