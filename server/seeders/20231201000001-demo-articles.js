"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "Articles",
      [
        // News Articles
        {
          title: "Latest Championship Results",
          excerpt: "Your short summary.",
          content: "The recent championship saw incredible performances...",
          category: "news",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image2/600/400",
        },
        {
          title: "New Training Facility Opening",
          excerpt: "Your short summary.",
          content: "The federation is proud to announce...",
          category: "news",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image2/600/400",
        },
        {
          title: "Federation Updates",
          excerpt: "Your short summary.",
          content: "Important updates from the federation...",
          category: "news",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image5/600/400",
        },

        // Competition Articles
        {
          title: "Summer Championship 2023",
          excerpt: "Your short summary.",
          content: "The Summer Championship 2023 will be held...",
          category: "competition",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image8/600/400",
        },
        {
          title: "Regional Tournament Results",
          excerpt: "Your short summary.",
          content: "The Eastern Regional Tournament concluded...",
          category: "competition",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image5/600/400",
        },
        {
          title: "Upcoming Winter Competition",
          excerpt: "Your short summary.",
          content: "Registration is now open for the Winter Competition...",
          category: "competition",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image6/600/400",
        },

        // Blog Articles
        {
          title: "Knife Throwing Techniques",
          excerpt: "Your short summary.",
          content: "Master the art of knife throwing...",
          category: "blog",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image6/600/400",
        },
        {
          title: "Training Tips for Beginners",
          excerpt: "Your short summary.",
          content: "Essential tips for those starting...",
          category: "blog",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://picsum.photos/seed/image8/600/400",
        },
        {
          title: "Mental Preparation in Sports",
          excerpt: "Your short summary.",
          content: "The importance of mental preparation...",
          category: "blog",
          author: "Chinkhuslen", // ADD THIS
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
