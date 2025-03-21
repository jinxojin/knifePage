import "./style.css";

// client/main.js
async function getMessage() {
  try {
    const response = await fetch("http://localhost:3000/api/hello");
    const data = await response.json();

    alert(data.message); // Display the message in an alert box
  } catch (error) {
    console.error("Error fetching message:", error);
    alert("Error fetching message from server"); // Display error in alert
  }
}

document.addEventListener("DOMContentLoaded", getMessage);

document.addEventListener("DOMContentLoaded", () => {
  const burgerBtn = document.getElementById("burger-btn");
  const nav = document.querySelector("nav");
  const anchors = document.querySelectorAll("nav li a");
  let isBurgerActive = false;

  // Create the dropdown menu
  const dropdown = document.createElement("div");
  dropdown.className =
    "mx-auto absolute top-0 left-0 w-full transition-all duration-300 ease-in-out rounded-b-md dark:bg-blue-900/80 z-10 md:hidden backdrop-blur-sm";

  const list = document.createElement("ul");
  list.className =
    "flex flex-col justify-center items-evenly gap-6 text-center py-4 dark:text-white";
  dropdown.appendChild(list);

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
});
