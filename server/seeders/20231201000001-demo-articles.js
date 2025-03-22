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
          content: "The recent championship saw incredible performances...",
          category: "news",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image1.jpg",
        },
        {
          title: "New Training Facility Opening",
          content: "The federation is proud to announce...",
          category: "news",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image2.jpg",
        },
        {
          title: "Federation Updates",
          content: "Important updates from the federation...",
          category: "news",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image3.jpg",
        },

        // Competition Articles
        {
          title: "Summer Championship 2023",
          content: "The Summer Championship 2023 will be held...",
          category: "competition",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image4.jpg",
        },
        {
          title: "Regional Tournament Results",
          content: "The Eastern Regional Tournament concluded...",
          category: "competition",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image5.jpg",
        },
        {
          title: "Upcoming Winter Competition",
          content: "Registration is now open for the Winter Competition...",
          category: "competition",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image6.jpg",
        },

        // Blog Articles
        {
          title: "Knife Throwing Techniques",
          content: "Master the art of knife throwing...",
          category: "blog",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image7.jpg",
        },
        {
          title: "Training Tips for Beginners",
          content: "Essential tips for those starting...",
          category: "blog",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image8.jpg",
        },
        {
          title: "Mental Preparation in Sports",
          content: "The importance of mental preparation...",
          category: "blog",
          author: "Chinkhuslen", // ADD THIS
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
          imageUrl: "https://example.com/image9.jpg",
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Articles", null, {});
  },
};
