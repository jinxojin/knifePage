"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "Articles",
      [
        // News Articles
        {
          title_en: "Latest Championship Results", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "The recent championship saw incredible performances...", // Changed field name
          category: "news",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image2/600/400",
        },
        {
          title_en: "New Training Facility Opening", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "The federation is proud to announce...", // Changed field name
          category: "news",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image2/600/400",
        },
        {
          title_en: "Federation Updates", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "Important updates from the federation...", // Changed field name
          category: "news",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image5/600/400",
        },

        // Competition Articles
        {
          title_en: "Summer Championship 2023", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "The Summer Championship 2023 will be held...", // Changed field name
          category: "competition",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image8/600/400",
        },
        {
          title_en: "Regional Tournament Results", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "The Eastern Regional Tournament concluded...", // Changed field name
          category: "competition",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image5/600/400",
        },
        {
          title_en: "Upcoming Winter Competition", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "Registration is now open for the Winter Competition...", // Changed field name
          category: "competition",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image6/600/400",
        },

        // Blog Articles
        {
          title_en: "Knife Throwing Techniques", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "Master the art of knife throwing...", // Changed field name
          category: "blog",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image6/600/400",
        },
        {
          title_en: "Training Tips for Beginners", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "Essential tips for those starting...", // Changed field name
          category: "blog",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image8/600/400",
        },
        {
          title_en: "Mental Preparation in Sports", // Changed field name
          excerpt_en: "Your short summary.", // Changed field name
          content_en: "The importance of mental preparation...", // Changed field name
          category: "blog",
          author: "Chinkhuslen", 
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image9/600/400",
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Articles", null, {});
  },
};
