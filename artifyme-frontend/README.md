# ArtifyMe Frontend (React + Vite + TypeScript)

Modern, responsive customer web application for the Artify platform, built with React, Vite, and Tailwind CSS. It enables customers to explore categorized handmade portrait paintings, upload reference photos from any device, configure custom portrait sketches, and track orders.

---

## 🎨 Features

- **Dynamic Paintings Gallery**:
  - Filterable by artistic medium (**All**, **Pencil**, **Charcoal**, **Watercolor**, **Acrylic**, **Oil**).
  - High-definition portrait preview with a **1:1 square aspect ratio** ensuring reference thumbnails in the corner are never cropped or obscured.
  - Price pills and detailed medium tags for each artwork.
- **Customer Photo Uploader**:
  - Browse photos directly from local device (phone, laptop, desktop) or drag-and-drop.
  - Client-side validation for image formats (JPEG, PNG, WebP) and file sizes up to 10MB.
  - Instant thumbnail preview with remove/reselect support.
- **Interactive Multi-Step Order Wizard**:
  - Step 1: Select medium (Pencil, Charcoal, Watercolor, Acrylic, Oil).
  - Step 2: Choose portrait size (A4, A3, A2) and number of faces (1, 2, 3+).
  - Step 3: Upload reference photo and add custom delivery instructions.
  - Live price estimation updating in real time.
- **Seamless Guest & User Flow**:
  - Guest customers browsing the gallery are prompted to Log In or Register before submitting their custom order.
  - State persistence preserves selected category/medium across the login/register transition.
- **Account & Order History**:
  - View placed orders, order status badges (`PLACED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`), delivery notes, and final completed portrait artwork.

---

## 🚀 Tech Stack

- **Framework**: [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) + PostCSS + Autoprefixer
- **Icons**: [Lucide React](https://lucide.dev/) (via SVG symbol sprite)
- **Data Fetching & Cache**: [TanStack React Query v5](https://tanstack.com/query)
- **Routing**: [React Router v6](https://reactrouter.com/)
- **Form Management**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)

---

## 📁 Directory Structure

```
artifyme-frontend/
├── public/                  # Static assets (favicons, manifest, SVG icons)
├── src/
│   ├── assets/              # Static media assets
│   ├── components/
│   │   └── PhotoUploader.tsx # File browser & drag-and-drop reference photo uploader
│   ├── lib/
│   │   ├── api.ts           # Centralized API fetch wrapper with Auth Bearer tokens
│   │   └── auth.tsx         # AuthContext provider & hooks (login, register, logout)
│   ├── pages/
│   │   ├── HomePage.tsx     # Landing page & dynamic categorized gallery
│   │   ├── LoginPage.tsx    # Customer login
│   │   ├── RegisterPage.tsx # Customer registration
│   │   ├── OrderWizardPage.tsx # Custom portrait ordering wizard
│   │   ├── OrderSuccessPage.tsx# Post-order confirmation screen
│   │   └── AccountPage.tsx  # Customer profile & order history tracking
│   ├── types/
│   │   └── order.ts         # TypeScript definitions for orders, products, paintings
│   ├── App.tsx              # Root component & Route definitions
│   ├── main.tsx             # Application entry point with React Query client
│   └── index.css            # Tailwind directives and custom base styles
├── env.example              # Example environment configuration
├── package.json             # NPM dependencies and scripts
├── tailwind.config.js       # Tailwind theme and plugin configuration
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite build and proxy settings
```

---

## ⚙️ Environment Configuration

Copy `env.example` to `.env`:

```bash
cp env.example .env
```

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `http://localhost:8080` | URL of the running Artify backend API |

---

## 🛠️ Development & Build Scripts

```bash
# Install dependencies
npm install

# Start Vite development server (http://localhost:5173)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

> [!NOTE]
> On **Windows PowerShell**, if execution policy blocks `npm`, run with `npm.cmd`:
> ```powershell
> npm.cmd install
> npm.cmd run dev
> npm.cmd run build
> ```

---

## 🔗 Connected Services

- The frontend interacts with the Go API backend on `http://localhost:8080`.
- Artwork images are fetched from `http://localhost:8080/paintings/<filename>.jpg`.
- Uploaded reference photos are stored and served from `http://localhost:8080/uploads/<filename>`.
