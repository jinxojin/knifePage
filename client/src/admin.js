import "./style.css";

// --- Helper function to get the JWT ---
function getToken() {
  return localStorage.getItem("adminToken");
}

// --- Login ---
async function login(username, password) {
  try {
    const response = await fetch("http://localhost:3000/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("adminToken", data.token);
      showArticleList(); // Show the article list after successful login
      document.getElementById("login-form").style.display = "none";
    } else {
      const errorData = await response.json();
      console.error("Login failed:", errorData.message);
      document.getElementById("login-message").textContent =
        "Login Failed: " + errorData.message;
    }
  } catch (error) {
    console.error("Error during login:", error);
    document.getElementById("login-message").textContent =
      "Login Failed: " + error;
  }
}

// --- Fetch Articles ---
async function fetchArticles() {
  try {
    const token = getToken();
    if (!token) {
      // Not logged in; redirect to login or show login form
      showLoginForm();
      return;
    }

    const response = await fetch("http://localhost:3000/api/articles", {
      headers: {
        Authorization: `Bearer ${token}`, // Include the JWT
      },
    });

    if (response.ok) {
      const articles = await response.json();
      displayArticles(articles); // Call a function to display the articles
    } else if (response.status === 401 || response.status === 403) {
      //Unauthorized
      showLoginForm();
    } else {
      const errorData = await response.json();
      console.error("Error fetching articles:", errorData.message);
      document.getElementById("article-form-message").textContent =
        "Error: " + errorData.message;
    }
  } catch (error) {
    console.error("Error fetching articles:", error);
    document.getElementById("article-form-message").textContent =
      "Error: " + error;
  }
}

// --- Display Articles (Example - Adapt to your HTML structure) ---
function displayArticles(articles) {
  const container = document.getElementById("articles-container");
  container.innerHTML = ""; // Clear previous content

  articles.forEach((article) => {
    const articleDiv = document.createElement("div");
    articleDiv.classList.add("article");

    articleDiv.innerHTML = `
      <h3>${article.title}</h3>
      <p>${article.content}</p>
      <p>Category: ${article.category}</p>
       <p>Author: ${article.author}</p>
       <img src="${article.imageUrl}" alt="${article.title}">
      <button class="edit-button" data-id="${article.id}">Edit</button>
      <button class="delete-button" data-id="${article.id}">Delete</button>
      <hr>
    `;

    container.appendChild(articleDiv);
  });
  //Add event listener to edit buttons
  document.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const articleId = event.target.dataset.id;
      showEditArticleForm(articleId); // Implement this function
    });
  });

  //Add event listener to delete buttons
  document.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const articleId = event.target.dataset.id;
      deleteArticle(articleId);
    });
  });
}

// --- Show Article List (and hide other sections) ---
function showArticleList() {
  document.getElementById("article-list").style.display = "block";
  document.getElementById("article-form-container").style.display = "none";
}

// --- Show Login Form ---
function showLoginForm() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("article-list").style.display = "none";
  document.getElementById("article-form-container").style.display = "none";
}

// --- Show create article form ---
function showCreateArticleForm() {
  document.getElementById("article-form-container").style.display = "block";
  document.getElementById("article-list").style.display = "none";
  //Clear the form for new article
  document.getElementById("article-form").reset();
  document.getElementById("article-id").value = ""; // Important: clear the ID
}
// --- Show edit article form and populating ---
async function showEditArticleForm(articleId) {
  document.getElementById("article-form-container").style.display = "block";
  document.getElementById("article-list").style.display = "none";

  try {
    const token = getToken();
    const response = await fetch(
      `http://localhost:3000/api/articles/${articleId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      const article = await response.json();

      //Populate form with data
      document.getElementById("article-id").value = article.id;
      document.getElementById("article-title").value = article.title;
      document.getElementById("article-content").value = article.content;
      document.getElementById("article-category").value = article.category;
      document.getElementById("article-author").value = article.author;
      document.getElementById("article-image-url").value = article.imageUrl;
    } else {
      const errorData = await response.json();
      console.error("Error fetching article data for edit ", errorData.message);
      document.getElementById("article-form-message").textContent =
        "Error: " + errorData.message;
    }
  } catch (err) {
    console.error("Error fetching article for edit: ", err);
    document.getElementById("article-form-message").textContent =
      "Error: " + err;
  }
}

// --- Logout ---
function logout() {
  localStorage.removeItem("adminToken");
  showLoginForm();
}

// --- Create Article---
async function createArticle(title, content, category, author, imageUrl) {
  try {
    const token = localStorage.getItem("adminToken");

    const response = await fetch("http://localhost:3000/api/admin/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, content, category, author, imageUrl }),
    });

    if (response.ok) {
      const newArticle = await response.json();
      console.log("Article created ", newArticle);
      // Refresh the article list or redirect
      fetchArticles();
      //Hide the create article form, and show the list
      showArticleList();
    } else {
      const errorData = await response.json();
      console.error("Error creating article", errorData.message);
      document.getElementById("article-form-message").textContent =
        "Error: " + errorData.message;
    }
  } catch (err) {
    console.error("Error creating article: ", err);
    document.getElementById("article-form-message").textContent =
      "Error: " + error;
  }
}

// --- Update Article ---
async function updateArticle(id, title, content, category, author, imageUrl) {
  try {
    const token = localStorage.getItem("adminToken");
    const response = await fetch(
      `http://localhost:3000/api/admin/articles/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content, category, author, imageUrl }),
      },
    );

    if (response.ok) {
      const updatedArticle = await response.json();
      console.log("Article updated ", updatedArticle);
      // Refresh the article list or redirect
      fetchArticles();
      showArticleList();
    } else {
      const errorData = await response.json();
      console.error("Error updating article", errorData.message);
      document.getElementById("article-form-message").textContent =
        "Error: " + errorData.message;
    }
  } catch (err) {
    console.error("Error updating Article, ", err);
    document.getElementById("article-form-message").textContent =
      "Error: " + error;
  }
}

// --- Delete Article ---
async function deleteArticle(id) {
  try {
    const token = localStorage.getItem("adminToken");
    const response = await fetch(
      `http://localhost:3000/api/admin/articles/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      console.log("Article Deleted");
      fetchArticles(); //refresh
    } else {
      const errorData = await response.json();
      console.error("Error Deleting Article", errorData.message);
      document.getElementById("article-form-message").textContent =
        "Error: " + errorData.message;
    }
  } catch (err) {
    console.error("Error Deleting Article, ", err);
    document.getElementById("article-form-message").textContent =
      "Error: " + error;
  }
}

// --- Event Listeners ---

document.addEventListener("DOMContentLoaded", () => {
  //Check if user is already logged in
  const token = getToken();
  if (token) {
    showArticleList();
    fetchArticles();
  } else {
    showLoginForm();
  }
  // Login form submission
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;
      login(username, password);
    });
  }

  // Create article form submission
  const createArticleForm = document.getElementById("article-form");
  if (createArticleForm) {
    createArticleForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = document.getElementById("article-id").value; // Hidden input for ID
      const title = document.getElementById("article-title").value;
      const content = document.getElementById("article-content").value;
      const category = document.getElementById("article-category").value;
      const author = document.getElementById("article-author").value;
      const imageUrl = document.getElementById("article-image-url").value;

      if (id) {
        //Update Article
        updateArticle(id, title, content, category, author, imageUrl);
      } else {
        //Create Article
        createArticle(title, content, category, author, imageUrl);
      }
    });
  }

  //Event Listener for create article button
  const createArticleButton = document.getElementById("create-article-button");
  if (createArticleButton) {
    createArticleButton.addEventListener("click", showCreateArticleForm);
  }

  //Event listener for cancel button on article form
  const cancelButton = document.getElementById("cancel-button");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      showArticleList();
    });
  }
});
