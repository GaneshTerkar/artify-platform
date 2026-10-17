# Artify Platform

[![Go Version](https://img.shields.io/badge/Go-1.25+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![React Version](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat&logo=postgresql)](https://www.postgresql.org/)

Artify is a portrait sketch and painting ordering platform that connects customers with skilled portrait artists. Customers can explore a categorized gallery of authentic artwork, upload reference photos from their device, configure custom sketch orders (size, medium, number of faces), and track artwork progress from placement to completion.

---

## 🏗️ Repository Architecture

This repository is structured as a full-stack monorepo:

```
artify-platform/
├── artifyme-backend/       # Go (Gin) REST API backend
│   ├── cmd/
│   │   ├── internal/       # Config, db, logger, middleware, routes, and domain modules
│   │   │   └── modules/    # artists, auth, files, orders, users
│   │   ├── migrations/     # PostgreSQL SQL migrations (001 to 010)
│   │   └── server/         # API server entrypoint (main.go)
│   ├── docs/               # Swagger API specifications
│   ├── Paintings/          # Authentic artist catalog images served at /paintings/
│   ├── env.example         # Backend environment template
│   └── README.md           # Dedicated backend documentation
│
├── artifyme-frontend/      # React (Vite + TypeScript + Tailwind CSS) web app
│   ├── public/             # Static public assets (icons, manifest)
│   ├── src/                # Components, pages, auth context, API client, types
│   ├── env.example         # Frontend environment template
│   └── README.md           # Dedicated frontend documentation
│
├── docker-compose.yml      # Local development container orchestration (PostgreSQL)
├── docs/                   # Product requirements & architectural documentation
│   └── PRODUCT_BRIEF.md
├── .env.example            # Master environment configuration reference
├── .gitignore              # Repository git ignore rules
└── README.md               # Main project overview (this file)
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- **Go** ≥ 1.21 (tested on Go 1.25)
- **Node.js** ≥ 18 and **npm**
- **Docker & Docker Compose** (or a local PostgreSQL 14+ instance)

---

### 2. Start PostgreSQL Database

Start PostgreSQL via Docker Compose:

```bash
docker compose up -d
```

> [!NOTE]
> If you already have a local PostgreSQL service running on port `5432`, ensure database `artifyme` exists with appropriate credentials matching your `.env`.

---

### 3. Setup and Run the Backend

```bash
cd artifyme-backend

# Create your local .env configuration
cp env.example .env

# Run the backend API server
go run cmd/server/main.go
```

> [!TIP]
> **Automatic Migrations**: The backend automatically connects to PostgreSQL and applies all pending SQL migrations (`001` through `010`) on startup. No manual migration CLI commands are required!

The API will be live at:
- **API Base**: `http://localhost:8080`
- **Swagger Documentation**: `http://localhost:8080/swagger/index.html`
- **Health Check**: `http://localhost:8080/health`

---

### 4. Setup and Run the Frontend

Open a second terminal:

```bash
cd artifyme-frontend

# Install dependencies
npm install

# Create frontend .env configuration
cp env.example .env

# Start Vite development server
npm run dev
```

> [!NOTE]
> On **Windows PowerShell**, if execution policies restrict `npm`, run with `npm.cmd` (e.g. `npm.cmd run dev`).

Open your browser at **`http://localhost:5173`**.

---

## 🎨 Key Features & User Journey

1. **Dynamic Database-Driven Gallery**:
   - Displays authentic paintings seeded directly into PostgreSQL (`artist_paintings`).
   - Categorized by true artistic medium: **Pencil**, **Charcoal**, **Watercolor**, **Acrylic**, and **Oil**.
   - Automatically incorporates newly completed customer orders into the public gallery.
   - 1:1 square display preventing artwork and reference photo clipping.

2. **Customer Photo Uploader**:
   - Browse files directly from any phone, laptop, or desktop with drag-and-drop support.
   - Client-side format (JPG, PNG, WebP) and size validation (up to 10MB).
   - Dual-backend storage: persists to local disk (`./uploads`) or S3 / MinIO.

3. **Multi-Step Custom Order Wizard**:
   - Choose medium, dimensions (A4, A3, A2), and number of subjects/faces (1, 2, 3+).
   - Dynamic pricing engine calculates live estimates.
   - Add reference photos and special delivery/framing notes.

4. **Guest Authentication Redirect**:
   - Guests can browse artworks and categories freely.
   - When a guest chooses to place an order, they are seamlessly guided to Log In or Register, preserving their selected medium and order intent.

5. **Customer Dashboard & Tracking**:
   - Real-time order status tracking: `PLACED` &rarr; `CONFIRMED` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`.
   - Access high-resolution completed artwork downloads upon delivery.

---

## ⚙️ Environment Variables Reference

A single reference file is provided at [`.env.example`](.env.example).

### Backend (`artifyme-backend/.env`)
| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgres://postgres:root@localhost:5432/artifyme?sslmode=disable` | PostgreSQL connection URL |
| `JWT_SECRET` | **Yes** | `change-me-in-production-use-long-random-string` | Secret key for signing auth tokens |
| `PORT` | No | `8080` | HTTP port |
| `APP_ENV` | No | `development` | `development` or `production` |
| `CORS_ALLOWED_ORIGINS`| No | `http://localhost:5173` | Allowed frontend origins |
| `MIGRATIONS_PATH` | No | `cmd/migrations` | Path to SQL migrations |
| `STRIPE_SECRET_KEY` | No | `""` | Stripe secret key (mock checkout when empty)|
| `S3_ENDPOINT` | No | `http://localhost:9000` | S3 / MinIO endpoint |
| `S3_BUCKET` | No | `artify-uploads` | Storage bucket name |

### Frontend (`artifyme-frontend/.env`)
| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `http://localhost:8080` | Base URL of the Go backend |

---

## 📡 API Overview

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Service health status |
| `POST` | `/auth/register` | Public | Register customer or artist account |
| `POST` | `/auth/login` | Public | Authenticate and obtain JWT |
| `GET` | `/api/v1/paintings` | Public | Dynamic gallery paintings with category filtering |
| `GET` | `/api/v1/products` | Public | Product catalog and base mediums |
| `GET` | `/api/v1/products/price/estimate` | Public | Calculate order pricing based on specs |
| `POST` | `/api/v1/upload` | User | Upload customer reference photo |
| `POST` | `/api/v1/orders` | User | Create a new custom portrait order |
| `GET` | `/api/v1/orders` | User | List orders for current authenticated user |
| `POST` | `/api/v1/orders/:id/checkout` | User | Generate checkout session |
| `GET` | `/api/v1/admin/orders` | Admin | Review all platform orders |
| `PATCH` | `/api/v1/admin/orders/:id/status` | Admin | Update order lifecycle status |

For the full interactive API contract, visit **Swagger UI** at `/swagger/index.html`.

---

## 📚 Further Reading

- [Functionality Guide (Feature by Feature)](docs/FUNCTIONALITY_GUIDE.md)
- [Backend Documentation](artifyme-backend/README.md)
- [Frontend Documentation](artifyme-frontend/README.md)
- [Product Brief & Requirements](docs/PRODUCT_BRIEF.md)

