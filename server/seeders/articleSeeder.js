// server/seeders/articleSeeder.js
const Article = require("../models/Article");

const seedArticles = [
  {
    title: "Upcoming National Championship",
    content: "Join us for the annual knife throwing championship...",
    category: "competitions",
    imageUrl: "/assets/comp-placeholder.jpg",
  },
  {
    title: "New Training Facility Opening",
    content: "We're excited to announce our new training facility...",
    category: "news",
    imageUrl: "/assets/news.jpg",
  },
  {
    title: "Techniques for Better Accuracy",
    content:
      "In this blog post, we discuss techniques to improve your throwing accuracy...",
    category: "blogs",
    imageUrl: "/assets/blog.jpg",
  },
];

async function seedArticles() {
  try {
    const count = await Article.count();

    if (count === 0) {
      console.log("Seeding test articles...");
      await Article.bulkCreate(seedArticles);
      console.log("Test articles seeded successfully");
    } else {
      console.log(`Database already has ${count} articles, skipping seed`);
    }
  } catch (error) {
    console.error("Error seeding articles:", error);
  }
}

module.exports = seedArticles;
