const { sequelize, Article } = require("../models");

async function checkArticles() {
  try {
    console.log("\nChecking Articles by Category:\n");

    // Get all unique categories
    const categories = await Article.findAll({
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("category")), "category"],
      ],
      raw: true,
    });

    console.log(
      "Available categories:",
      categories.map((c) => c.category)
    );

    // Check articles in each category
    for (const { category } of categories) {
      const articles = await Article.findAll({
        where: { category },
        attributes: ["id", "title", "category", "imageUrl"],
        raw: true,
      });

      console.log(`\n${category.toUpperCase()} Articles:`);
      articles.forEach((article) => {
        console.log(`- ${article.title} (ID: ${article.id})`);
      });
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
}

checkArticles();
