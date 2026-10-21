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
│   │   ├── migrations/     # PostgreSQL SQL migrations (001 to 016)
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
├── docs/                   # Product, API, functionality and Postman documentation
│   ├── PRODUCT_BRIEF.md
│   ├── API_DOCUMENTATION.md
│   ├── FUNCTIONALITY_GUIDE.md
│   └── postman/
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
> **Automatic Migrations**: The backend automatically connects to PostgreSQL and applies all pending SQL migrations (`001` through `016`) on startup. No manual migration CLI commands are required!

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

5. **Multi-Role End-to-End Order Workflow**:
   - Full lifecycle governance across Customer, Admin, Artist, and Delivery Agent roles.

```mermaid
flowchart TD
    subgraph S1["1. CUSTOMER: Order Commission & Payment"]
        C_START["Customer configures portrait & uploads photo"] --> C_PLACE["PLACED<br/>(Order Created)"]
        C_PLACE -->|"Payment confirmed (Razorpay / admin)"| A_CONF["CONFIRMED<br/>(Ready for Artist)"]
    end

    subgraph S2["2. ADMIN: Studio Artist Assignment"]
        A_CONF -->|"Admin assigns verified portrait artist"| ART_ASSIGN["ASSIGNED_ARTIST<br/>(Roster locked)"]
    end

    subgraph S3["3. ARTIST: Drawing & Submission"]
        ART_ASSIGN -->|"Artist accepts & starts canvas"| ART_PROG["IN_PROGRESS<br/>(Drawing portrait)"]
        ART_PROG -->|"Artist uploads high-res finished sketch"| COMPL["COMPLETED<br/>(Studio Complete)"]
        COMPL -.->|"Auto-synthesizes high-res comparison collage"| COLLAGE_GEN["Collage Generated<br/>(is_published_to_gallery = FALSE)"]
    end

    subgraph S4["4. ADMIN: Quality Inspection & Courier Assignment"]
        COLLAGE_GEN -->|"Admin inspects reference, sketch & collage"| ADM_INSPECT{"Studio Inspection"}
        ADM_INSPECT -->|"Admin selects verified courier partner"| DEL_ASSIGN["ASSIGNED_DELIVERY_AGENT<br/>(Package handed to courier)"]
    end

    subgraph S5["5. DELIVERY AGENT: Doorstep Handover & Transit"]
        DEL_ASSIGN -->|"Courier accepts package"| IN_TRANS["IN_TRANSIT<br/>(Dispatched)"]
        IN_TRANS -->|"Courier arrives in destination area"| OUT_DEL["OUT_FOR_DELIVERY<br/>(Courier on route)"]
        OUT_DEL -->|"Physical handover confirmed"| DELIVERED["DELIVERED<br/>(Customer receives portrait)"]
    end

    subgraph S6["6. ADMIN: Gallery Confirmation & Global Publishing"]
        DELIVERED -->|"Admin confirms high-res collage publication"| PUB["PUBLISHED<br/>(is_published_to_gallery = TRUE)"]
        PUB -.->|"Instantly visible in live gallery"| GALLERY_LIVE["Public Art Gallery (/gallery)"]
    end
```

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
| `PAYMENT_PROVIDER` | No | `manual` | `manual` (mock checkout, admin confirms) or `razorpay` |
| `PAYMENTS_LIVE` | No | `false` | Must be `true` (together with `razorpay`) to charge real money |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay only | `""` | API credentials. Test keys start with `rzp_test_`, live keys with `rzp_live_` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay only | `""` | Secret used to verify `X-Razorpay-Signature` |
| `RAZORPAY_API_BASE` | No | `https://api.razorpay.com` | Override for the local stub used in tests |
| `PAYMENT_MIN_AMOUNT` / `PAYMENT_MAX_AMOUNT` | No | `100` / `200000` | Server-side INR limits for gateway checkout |
| `STRIPE_SECRET_KEY` | No | `""` | Legacy mock checkout (superseded by `PAYMENT_PROVIDER`) |
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
| `GET` | `/api/v1/orders` | User | List orders for current authenticated user / courier |
| `POST` | `/api/v1/orders/:id/checkout` | User | Start checkout (manual mock or Razorpay order) |
| `POST` | `/api/v1/payments/verify` | User | Verify Razorpay checkout signature and confirm the order |
| `POST` | `/api/v1/orders/:id/confirm-payment` | Admin | Confirm a manual payment (`PLACED` → `CONFIRMED`) |
| `POST` | `/webhooks/razorpay` | Public (signed) | Razorpay webhook: captured/failed/refunded events |
| `POST` | `/api/v1/orders/:id/assign` | Artist/Admin | Assign order to verified portrait artist |
| `PATCH` | `/api/v1/orders/:id/status` | Artist/Courier | Update order state (drawing progress, courier transit) |
| `GET` | `/api/v1/admin/orders` | Admin | Review all platform orders |
| `PATCH` | `/api/v1/admin/orders/:id/status` | Admin | Update order lifecycle status |
| `POST` | `/api/v1/admin/orders/:id/assign-delivery` | Admin | Assign delivery agent to completed portrait |
| `GET` | `/api/v1/admin/delivery-agents` | Admin | List active verified delivery agents |
| `POST` | `/api/v1/admin/orders/:id/confirm-gallery` | Admin | Confirm & publish delivered artwork to public gallery |
| `POST` | `/api/v1/admin/orders/:id/refund` | Admin | Full refund of a captured Razorpay payment |

### Payments

Three modes are supported:

1. **Manual (default, no money):** `PAYMENT_PROVIDER=manual`. Checkout keeps the
   mock flow and the order stays `PLACED` until an admin confirms it with
   **Pay Now → Admin confirms**. Nothing is charged.
2. **Razorpay test mode (no real money):** set `PAYMENT_PROVIDER=razorpay`,
   `PAYMENTS_LIVE=false`, a `rzp_test_…` key pair and a webhook secret. Orders
   are confirmed automatically by the signed webhook (or the browser
   signature check). Test cards/UPI move no money and need no KYC.
3. **Razorpay live mode (real money):** additionally set `PAYMENTS_LIVE=true`
   and use `rzp_live_…` keys. Live mode requires a **public HTTPS webhook URL**,
   so it cannot work from localhost — deploy the API publicly first.

Safety rails: the server refuses to start if a `rzp_live_` key is configured
while `PAYMENTS_LIVE=false`, refuses `rzp_test_` keys when `PAYMENTS_LIVE=true`,
requires a webhook secret, enforces `PAYMENT_MIN_AMOUNT`/`PAYMENT_MAX_AMOUNT`,
verifies every webhook signature against the raw body, and ignores duplicate
webhook event IDs. Gateway amount is computed server-side from the order; the
client never sends the amount.

Local offline test (no keys, no network): the repository includes a Razorpay
stub and a full E2E script.

```powershell
cd artifyme-backend
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-payments.ps1
```

It creates a throw-away `artifyme_paytest` database, starts Redis, the stub and
the API, then exercises checkout, signed webhooks, duplicates, tampered
signatures, failed payments, browser verification, admin refunds and the
live-key guard. See `cmd/devtools/razorpay-stub` for the stub itself.

For the complete role-by-role API specification and ready-to-run requests, see [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) and [`artifyme-backend/api.http`](artifyme-backend/api.http).

---

## 📚 Further Reading

- [Complete API Documentation & Role Guide](docs/API_DOCUMENTATION.md)
- [Functionality Guide (Feature by Feature)](docs/FUNCTIONALITY_GUIDE.md)
- [Postman Collection & Environments](docs/postman/README.md)
- [Backend Documentation](artifyme-backend/README.md)
- [Frontend Documentation](artifyme-frontend/README.md)
- [Product Brief & Requirements](docs/PRODUCT_BRIEF.md)


