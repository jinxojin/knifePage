// src/main.js
import "./style.css";

// --- API Service ---
const API_URL = "http://localhost:3000/api";

async function fetchArticlesByCategory(category, limit = null) {
  try {
    let url = `${API_URL}/articles?category=${category}`;
    if (limit) url += `&limit=${limit}`;

    console.log(`Fetching from: ${url}`);
    const response = await fetch(url);
    const articles = await response.json();
    console.log(`${category} articles received:`, articles);

    return articles;
  } catch (error) {
    console.error(`Error fetching ${category} articles:`, error);
    return [];
  }
}

// Helper function to truncate HTML content safely
function truncateHTML(html, maxLength) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent || div.innerText || "";
  return text.substring(0, maxLength) + "...";
}

// Update article card with fetched content
function updateArticleCard(container, article) {
  if (!container || !article) return;

  const contentDiv = container.querySelector(".p-5");
  if (contentDiv) {
    // Update title
    const titleElement = contentDiv.querySelector("h5");
    if (titleElement) titleElement.textContent = article.title;

    // Update content
    const contentElement = contentDiv.querySelector("p");
    if (contentElement)
      contentElement.textContent = truncateHTML(article.content, 150);

    // Update link
    const linkElement = contentDiv.querySelector("a.bg-primary-700");
    if (linkElement) linkElement.href = `article.html?id=${article.id}`;

    // Update image if available
    const imgContainer = container.querySelector("a");
    const imgElement = imgContainer?.querySelector("img");
    if (imgElement && article.imageUrl) {
      imgElement.src = article.imageUrl;
      imgElement.alt = article.title;
    }
  }
}

// Function to get welcome message (placeholder for your getMessage function)
function getMessage() {
  // Your existing getMessage implementation
  console.log("Welcome message loaded");
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  // Call getMessage function
  getMessage();

  // --- Burger Menu Animation ---
  const burgerBtn = document.getElementById("burger-btn");
  const nav = document.querySelector("nav");
  const anchors = document.querySelectorAll("nav li a");
  let isBurgerActive = false;

  // Create the dropdown menu
  const dropdown = document.createElement("div");
  dropdown.className =
    "mx-auto absolute top-0 left-0 w-full transition-all duration-300 ease-in-out rounded-b-md dark:bg-primary-800/70 z-10 md:hidden backdrop-blur-sm";

  const list = document.createElement("ul");
  list.className =
    "flex flex-col justify-center items-evenly gap-6 text-center py-4 dark:text-white";
  dropdown.appendChild(list);

  // Clone navigation links for mobile menu
  for (const anchor of anchors) {
    const listItem = document.createElement("li");
    const newAnchor = document.createElement("a");
    newAnchor.textContent = anchor.textContent;
    newAnchor.href = anchor.href;
    // Add transition to the anchor for hover effect
    newAnchor.className =
      "font-md transition-colors duration-200 hover:text-blue-500";
    listItem.appendChild(newAnchor);
    list.appendChild(listItem);
  }

  // Insert dropdown before the first child of nav
  nav.insertBefore(dropdown, nav.firstChild);

  // Adjust z-index and transform-origin of original button
  burgerBtn.style.position = "relative";
  burgerBtn.style.zIndex = "20";
  burgerBtn.style.transition = "transform 0.3s ease-in-out";
  burgerBtn.style.transformOrigin = "center";

  // Event listener for burger button
  function toggleDropdown() {
    isBurgerActive = !isBurgerActive;
    dropdown.classList.toggle("max-h-0");
    dropdown.classList.toggle("max-h-screen");

    // Rotate the button
    if (isBurgerActive) {
      burgerBtn.style.transform = "rotate(180deg)";
      burgerBtn.className = "text-white";
    } else {
      burgerBtn.style.transform = "rotate(0deg)";
      burgerBtn.classList.remove("text-white");
    }

    if (isBurgerActive) {
      dropdown.classList.add("opacity-100", "scale-y-100");
    } else {
      dropdown.classList.remove("opacity-100", "scale-y-100");
    }
  }

  burgerBtn.addEventListener("click", toggleDropdown);

  // Close dropdown when clicking outside
  document.addEventListener("click", (event) => {
    if (
      isBurgerActive &&
      !dropdown.contains(event.target) &&
      !burgerBtn.contains(event.target)
    ) {
      toggleDropdown();
    }
  });

  // Initial State: max-height 0, opacity 0, scale-y 0
  dropdown.classList.add("max-h-0", "opacity-0", "scale-y-0");
  dropdown.style.transformOrigin = "top";

  // --- Language Button Functionality ---
  const languageBtn = document.getElementById("language-btn");
  if (languageBtn) {
    languageBtn.addEventListener("click", () => {
      // Toggle language logic here
      console.log("Language toggle clicked");
    });
  }

  // --- Fetch Latest Articles ---
  // For homepage sections
  if (document.getElementById("highlight-competitions")) {
    fetchArticlesByCategory("competitions", 1).then((articles) => {
      if (articles.length > 0) {
        updateArticleCard(
          document.getElementById("highlight-competitions"),
          articles[0],
        );
      }
    });
  }

  if (document.getElementById("highlight-news")) {
    fetchArticlesByCategory("news", 1).then((articles) => {
      if (articles.length > 0) {
        updateArticleCard(
          document.getElementById("highlight-news"),
          articles[0],
        );
      }
    });
  }

  if (document.getElementById("highlight-blogs")) {
    fetchArticlesByCategory("blogs", 1).then((articles) => {
      if (articles.length > 0) {
        updateArticleCard(
          document.getElementById("highlight-blogs"),
          articles[0],
        );
      }
    });
  }
});
