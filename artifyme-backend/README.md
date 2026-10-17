# ArtifyMe Backend (Go + Gin + PostgreSQL)

High-performance REST API backend for the Artify platform, powering portrait sketch ordering, dynamic art gallery, customer authentication, file uploads, and artist order workflows.

---

## 🚀 Tech Stack

- **Language & Runtime**: Go 1.25+
- **HTTP Web Framework**: [Gin Gonic](https://github.com/gin-gonic/gin) (`v1.11.0`)
- **Database Driver**: [pgx/v5](https://github.com/jackc/pgx) with connection pooling (`pgxpool`)
- **Database Migrations**: [golang-migrate/migrate/v4](https://github.com/golang-migrate/migrate) (integrated directly into server startup)
- **Authentication**: JWT (`golang-jwt/jwt/v5`) & bcrypt passwords (`golang.org/x/crypto`)
- **API Documentation**: [Swagger / OpenAPI](https://github.com/swaggo/gin-swagger) via Swaggo
- **Cloud Storage**: AWS SDK Go v2 S3 client with local disk storage fallback

---

## 📁 Architecture & Directory Layout

```
artifyme-backend/
├── cmd/
│   ├── internal/
│   │   ├── config/          # Environment configuration loading & validation
│   │   ├── db/              # pgxpool setup and embedded database migration runner
│   │   ├── errors/          # Common error definitions
│   │   ├── logger/          # Structured slog logging setup
│   │   ├── middleware/      # JWT auth, CORS, role and status RBAC middleware
│   │   ├── modules/
│   │   │   ├── artists/     # Artist profiles, verification, review queue
│   │   │   ├── auth/        # Customer/artist registration and login (JWT)
│   │   │   ├── files/       # File upload handler (Local disk / S3 / MinIO)
│   │   │   ├── orders/      # Orders, products, dynamic catalog, price estimation, Stripe
│   │   │   └── users/       # User profile and account management
│   │   ├── routes/          # Central API route registration
│   │   └── utils/           # Password hashing, token generation, helpers
│   ├── migrations/          # SQL migrations 001 to 010 (up & down)
│   └── server/
│       └── main.go          # Server entry point
├── docs/                    # Swagger generated API specs (swagger.json, doc.go)
├── Paintings/               # Authentic artist portrait images served at /paintings/
├── env.example              # Example environment configuration
├── go.mod                   # Go module definition
└── go.sum                   # Dependency checksums
```

---

## ⚙️ Environment Variables

Copy `env.example` to `.env`:

```bash
cp env.example .env
```

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgres://postgres:root@localhost:5432/artifyme?sslmode=disable` | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | `change-me-in-production-use-long-random-string` | Secret key for signing customer and artist JWTs |
| `PORT` | No | `8080` | Port for the HTTP server |
| `APP_ENV` | No | `development` | Environment (`development` or `production`) |
| `MIGRATIONS_PATH` | No | `cmd/migrations` | Path to SQL migrations directory |
| `CORS_ALLOWED_ORIGINS`| No | `http://localhost:5173` | Allowed frontend origins (comma-separated) |
| `JWT_EXPIRES_IN` | No | `24` | Token expiration in hours |
| `STRIPE_SECRET_KEY` | No | `""` | Stripe secret key (mock checkout when empty) |
| `STRIPE_SUCCESS_URL` | No | `http://localhost:5173/order/success` | Redirect on payment success |
| `STRIPE_CANCEL_URL` | No | `http://localhost:5173/order/cancel` | Redirect on payment cancellation |
| `S3_ENDPOINT` | No | `http://localhost:9000` | S3 / MinIO endpoint |
| `S3_BUCKET` | No | `artify-uploads` | S3 bucket name |
| `S3_ACCESS_KEY` | No | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | No | `minioadmin` | S3 secret key |

---

## 🗄️ Database Migrations

### Automatic Migrations
When `cmd/server/main.go` starts, it automatically applies all pending SQL migrations up to the latest version using the embedded `golang-migrate` runner. **No manual migration commands are required for normal development.**

### Existing Migrations

1. `001_init_schema`: Core schema (users, roles, artists, orders, order items, reviews).
2. `002_add_artist_review_states`: Artist verification states (`PENDING`, `UNDER_REVIEW`, `ACTIVE`, `REJECTED`).
3. `003_remove_timestamp_defaults_and_triggers`: Timestamp handling cleanup.
4. `004_add_indexes`: Performance indexes on foreign keys and order queries.
5. `005_log_order_status_change`: Audit table and triggers for order lifecycle events.
6. `006_update_user_name`: Name formatting improvements.
7. `007_calculate_order_total_price`: Dynamic pricing calculations.
8. `008_payments_and_order_notes`: Payments table, Stripe session tracking, order delivery notes.
9. `009_restore_orders_timestamp_defaults`: Restores standard timestamps on orders.
10. `010_seed_gallery_paintings`: Seeds the 22 authentic paintings into `artist_paintings` categorized by artistic medium.

### Manual Migrations (Optional CLI)

If you have `golang-migrate` installed:

```bash
# Apply migrations
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" -path cmd/migrations up

# Rollback last migration
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" -path cmd/migrations down 1

# Check current version
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" -path cmd/migrations version
```

---

## 🚀 Running the Server

### Development
```bash
go run cmd/server/main.go
```

### Production Build
```bash
go build -o server.exe ./cmd/server
./server.exe
```

---

## 📖 API Documentation & Swagger

Interactive Swagger UI documentation is available out of the box:

- **Swagger UI**: `http://localhost:8080/swagger/index.html`
- **Swagger JSON**: `http://localhost:8080/swagger/doc.json`

To regenerate Swagger docs after updating annotations:
```bash
swag init -g cmd/server/main.go -o docs/
```

---

## 📡 Key API Endpoints

### Public Routes
- `GET /health` & `GET /healthz` &mdash; Health check
- `POST /auth/register` &mdash; Register customer/artist
- `POST /auth/login` &mdash; Login and obtain JWT
- `GET /api/v1/paintings` &mdash; Dynamic paintings gallery (supports `?category=PENCIL`)
- `GET /api/v1/products` &mdash; Product catalog and base medium options
- `GET /api/v1/products/price/estimate` &mdash; Dynamic price calculator
- `GET /paintings/*` &mdash; Statically serves authentic artwork photos
- `GET /uploads/*` &mdash; Statically serves uploaded reference photos

### Authenticated Customer Routes (`Bearer <token>`)
- `GET /api/me` &mdash; Current user profile and role
- `POST /api/v1/upload` &mdash; Upload reference image (multipart form)
- `POST /api/v1/orders` &mdash; Create customized portrait order
- `GET /api/v1/orders` &mdash; List authenticated user's orders
- `GET /api/v1/orders/:id` &mdash; Retrieve order details
- `POST /api/v1/orders/:id/checkout` &mdash; Initiate checkout session

### Artist & Admin Routes
- `GET /api/artist/profile/view` &mdash; Artist profile
- `GET /api/admin/artists/review-queue` &mdash; Artist verification queue
- `GET /api/v1/admin/orders` &mdash; Manage customer orders
- `PATCH /api/v1/admin/orders/:id/status` &mdash; Update order status (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`)
