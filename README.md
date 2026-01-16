# Mongolian Sports Knife Throwing Federation (MSKTF)

The official web platform for the MSKTF, built for performance, security, and a premium user experience. This project features a multi-lingual news portal, competition tracking, and a secure administrative dashboard.

## 🚀 Tech Stack

### Frontend
- **Framework:** Vanilla JavaScript with [Vite 6](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (using the new `@theme` and `@layer` directives)
- **Icons:** Flaticon UIcons (Regular & Bold Rounded)
- **Internationalization:** Custom i18n system supporting English (EN), Mongolian (MN), and Russian (RU)
- **Features:** Glassmorphism UI, Skeleton Loaders, Reading Progress Bars, and cinematic Hero animations.

### Backend
- **Runtime:** Node.js (v22+)
- **Framework:** Express.js
- **Database:** PostgreSQL (Production) / Sequelize ORM
- **Security:** 
  - JWT-based authentication with Refresh Tokens.
  - Double CSRF protection via `csrf-csrf`.
  - Model-level HTML sanitization via `sanitize-html`.
  - Rate limiting on sensitive routes.
- **Logging:** Winston Logger with daily rotated files.
- **Email:** Mailgun API integration.

---

## ✨ Key Features & Architectural Decisions

### 1. Optimized Password Reset (O(1) Lookup)
Unlike standard implementations that iterate through all users to verify a token, this system requires the `email` in the reset request. The server performs a direct database lookup by email, then verifies the hashed token using `bcrypt`. This prevents Timing Attacks and DoS vectors on the auth service.

### 2. Model-Level Security (XSS Prevention)
Security is baked into the data layer. Using Sequelize **hooks** (`beforeCreate`, `beforeUpdate`), all article content and excerpts are automatically sanitized before being saved. This ensures that no matter which route (Admin, Moderator, or Seeder) touches the data, the site remains safe from XSS.

### 3. Cohesive Design System
A strict design spec is applied across all content pages:
- **Max Width:** `max-w-5xl` for optimal readability.
- **Standard Spacing:** `pt-24 pb-16` main wrapper to account for the fixed glassmorphism navbar.
- **Breadcrumbs:** Static HTML breadcrumbs for SEO and stability, dynamically updated via JS titles.

---

## 🛠️ Local Development

### Prerequisites
- Node.js v22+
- PostgreSQL

### Setup
1. **Clone the repo:**
   ```bash
   git clone git@github.com:jinxojin/knifePage.git
   cd knifePage
   ```

2. **Environment Variables:**
   Create `server/.env`:
   ```env
   NODE_ENV=development
   PORT=3000
   JWT_SECRET=your_secret
   CSRF_SECRET=your_secret
   # Mailgun Credentials
   MAILGUN_API_KEY=...
   MAILGUN_DOMAIN=...
   ```

3. **Database Configuration:**
   Update `server/config/config.json` with your local Postgres credentials.

4. **Install & Migrate:**
   ```bash
   # Server
   cd server && npm install
   npx sequelize-cli db:migrate
   npx sequelize-cli db:seed:all
   node createAdmin.js # Creates default admin

   # Client
   cd ../client && npm install
   ```

5. **Run:**
   - Server: `npm run dev` (Port 3000)
   - Client: `npm run dev` (Port 5173 - Proxied to 3000)

---

## 🚢 Production Deployment

This project is deployed on **msktf.com** using Nginx as a reverse proxy.

### Deployment Workflow
1. **Pull & Install:**
   ```bash
   git pull origin main
   cd server && npm install
   cd ../client && npm install
   ```

2. **Build Frontend:**
   ```bash
   cd client && npm run build
   # Ensure Nginx points to client/dist
   ```

3. **Restart Backend:**
   ```bash
   cd server
   pm2 restart knife-page-api || nohup node app.js > server.log 2>&1 &
   ```

### Nginx Caching
To ensure users always see the latest UI without hard-refreshing, the Nginx config is set to serve `.html` files with `Cache-Control: no-store`.

---

## 📁 Project Structure
```text
.
├── client/                 # Vite Frontend
│   ├── src/
│   │   ├── locales/        # i18n JSON files
│   │   ├── uiUtils.js      # Global UI (Header/Footer)
│   │   └── articles.js     # Rendering Logic
│   └── index.html          # Main Entry
└── server/                 # Express Backend
    ├── models/             # Sequelize Models (with Security Hooks)
    ├── routes/             # API Endpoints
    ├── middleware/         # Auth & CSRF logic
    └── app.js              # Entry Point
```

## 🛡️ License
Copyright © 2026 Mongolian Sports Knife Throwing Federation. All rights reserved.
