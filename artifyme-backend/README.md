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
│   │   │   ├── orders/      # Orders, catalog, payments (manual/Razorpay), logistics
│   │   │   └── users/       # User profile and account management
│   │   ├── routes/          # Central API route registration
│   │   └── utils/           # Password hashing, token generation, helpers
│   ├── migrations/          # SQL migrations 001 to 016 (up & down)
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
| `PAYMENT_PROVIDER` | No | `manual` | `manual` (mock checkout, admin confirms) or `razorpay` |
| `PAYMENTS_LIVE` | No | `false` | Must be `true` (with `razorpay`) to charge real money |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay only | `""` | Test keys start with `rzp_test_`, live keys with `rzp_live_` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay only | `""` | Secret used to verify `X-Razorpay-Signature` |
| `RAZORPAY_API_BASE` | No | `https://api.razorpay.com` | Override for the local test stub |
| `PAYMENT_MIN_AMOUNT` / `PAYMENT_MAX_AMOUNT` | No | `100` / `200000` | Server-side INR limits for gateway checkout |
| `STRIPE_SECRET_KEY` | No | `""` | Legacy mock checkout; superseded by `PAYMENT_PROVIDER` |
| `S3_ENDPOINT` | No | `http://localhost:9000` | S3 / MinIO endpoint |
| `S3_BUCKET` | No | `artify-uploads` | S3 bucket name |
| `S3_ACCESS_KEY` | No | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | No | `minioadmin` | S3 secret key |
| `S3_USE_PATH_STYLE` | No | `true` | Use path-style addressing (MinIO compatibility) |

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
8. `008_payments_and_order_notes`: Payments table, order customer notes, and legacy Stripe session field.
9. `009_restore_orders_timestamp_defaults`: Restores standard timestamps on orders.
10. `010_add_collage_and_gallery_confirmation`: Auto-generated comparison collage URLs, original sketch preservation, and `is_published_to_gallery` confirmation flag.
11. `011_add_delivery_transit_and_retry`: Delivery agent assignment (`delivery_agent_id`), courier transit states (`IN_TRANSIT`, `DELIVERY_FAILED`), attempt counter, and failure reasons.
12. `012_add_published_order_status`: Extends PostgreSQL `order_status` enum adding `PUBLISHED` status.
13. `013_add_user_sessions_and_optimistic_locking`: Multi-device sessions, order `version` column, and idempotency keys.
14. `014_create_outbox_events`: Transactional outbox table for reliable event dispatch.
15. `015_add_logistics_and_customer_reviews`: Courier partner, tracking number, estimated delivery, dispatch notes, and verified customer reviews.
16. `016_payment_providers_and_webhook_events`: Provider-neutral payment fields (`provider`, provider order/payment IDs, failure reason, raw payload) and idempotent `payment_events`.

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

## 📖 API Documentation & In-Repo Testing

- **Complete In-Repo Role-Based API Guide**: [`docs/API_DOCUMENTATION.md`](../docs/API_DOCUMENTATION.md) (covers all endpoints, token generation, request/response examples, and role validation).
- **Executable HTTP Collection**: [`api.http`](api.http) (pre-configured for VS Code REST Client / IntelliJ HTTP Client to execute every endpoint by role with 1 click).
- **Postman Collection**: [`docs/postman/README.md`](../docs/postman/README.md) (87 requests, automatic token capture, demo-ID sync and signed webhook tests).
- **Swagger UI**: `http://localhost:8080/swagger/index.html` (public catalog and protected business operations).


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
- `POST /api/v1/orders/:id/checkout` &mdash; Start manual or Razorpay checkout
- `POST /api/v1/payments/verify` &mdash; Verify Razorpay browser signature and confirm the order

### Payments & Webhooks
- `POST /webhooks/razorpay` &mdash; Signed Razorpay webhook; captures, failures and refunds are idempotent
- `POST /api/v1/orders/:id/confirm-payment` &mdash; Admin-only manual payment confirmation
- `POST /api/v1/admin/orders/:id/refund` &mdash; Full refund for a captured Razorpay payment
- `PAYMENT_PROVIDER=manual` requires no gateway; `razorpay` requires the keys/webhook secret above. Live mode also needs `PAYMENTS_LIVE=true` and a public HTTPS webhook.

### Artist & Admin Routes
- `GET /api/artist/profile/view` &mdash; Artist profile
- `GET /api/admin/artists/review-queue` &mdash; Artist verification queue
- `GET /api/v1/admin/orders` &mdash; Manage customer orders
- `PATCH /api/v1/admin/orders/:id/status` &mdash; Update order status through the full lifecycle
- `POST /api/v1/admin/orders/:id/assign-delivery` &mdash; Assign a delivery agent and optional carrier/tracking details
