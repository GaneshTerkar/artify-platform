# Artify Platform – Backend Setup Guide

This document explains how to set up, run, and maintain the **Artify Platform backend**, including database migrations, project structure, and common troubleshooting steps.

---

## 📁 Project Structure
cmd
├── internal
│ ├── config
│ │ └── config.go # Application configuration loader
│ │
│ ├── db
│ │ ├── postgres.go # PostgreSQL connection setup
│ │ └── schema.sql # Reference SQL schema (do not run directly)
│ │
│ ├── errors
│ │ └── errors.go # Centralized error definitions
│ │
│ ├── middleware
│ │ ├── auth.go # JWT authentication middleware
│ │ └── rbac.go # Role-based access control
│ │
│ ├── modules
│ │ ├── artists # Artist domain module
│ │ ├── auth # Authentication module
│ │ ├── files # File management
│ │ ├── notifications # Notifications
│ │ ├── orders # Order lifecycle
│ │ └── users # User management
│ │
│ ├── routes
│ │ └── routes.go # API route registration
│ │
│ └── utils
│ ├── context.go
│ ├── jwt.go
│ ├── password.go
│ └── response.go
│
├── migrations/ # Database migration scripts
└── server
└── main.go # Application entry point

````

---

## 🧱 Prerequisites

Ensure the following tools are installed:

- **Go** ≥ 1.21
- **PostgreSQL** ≥ 14
- **golang-migrate CLI**

### Install golang-migrate

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
````

Verify installation:

```bash
migrate -version
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root:

```env
DB_HOST=host
DB_PORT=port
DB_NAME=database_name
DB_USER=dbuser
DB_PASSWORD=dbpassword
DB_SSLMODE=disable
```

The database URL used by migrations:

```
postgres://dbuser:dbpassword@host:port/database_name?sslmode=disable
```

---

## 🗄️ Database Migrations

All migration files are located in:

```
cmd/migration
```

### Migration Naming Convention

- Sequential numbering
- 3 digits
- Paired `up.sql` and `down.sql`

Example:

```
003_remove_timestamp_defaults_and_triggers.up.sql
003_remove_timestamp_defaults_and_triggers.down.sql
```

---

## ➕ Create a New Migration

Use **sequential mode** to match the existing convention:

```bash
migrate create -ext sql -seq -digits 3 \
  -dir D:/ArtifyMe/artify-platform/artifyme-backend/cmd/migration \
  next_db_migration
```

This generates:

```
004_next_db_migration.up.sql
004_next_db_migration.down.sql
```

---

## ▶️ Run Migrations

### Apply All Migrations

```bash
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" \
  -path "D:/ArtifyMe/artify-platform/artifyme-backend/cmd/migration" \
  up
```

### Check Migration Version

```bash
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" \
  -path "D:/ArtifyMe/artify-platform/artifyme-backend/cmd/migration" \
  version
```

---

## ⬇️ Rollback Migrations

Rollback the last migration:

```bash
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" \
  -path "D:/ArtifyMe/artify-platform/artifyme-backend/cmd/migration" \
  down 1
```

Rollback **all** migrations:

```bash
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" \
  -path "D:/ArtifyMe/artify-platform/artifyme-backend/cmd/migration" \
  down -all
```

---

## 💣 Drop Database (Development Only)

⚠️ **Deletes all tables and migration history**

```bash
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" \
  -path "D:/ArtifyMe/artify-platform/artifyme-backend/cmd/migration" \
  drop -f
```

---

## 🧹 Dirty Migration Recovery

If a migration fails, the database may enter a **dirty state**:

```bash
migrate ... version
# Output: 1 (dirty)
```

Fix by forcing the version:

```bash
migrate -database "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable" \
  -path "D:/ArtifyMe/artify-platform/artifyme-backend/cmd/migration" \
  force 1
```

Then re-run:

```bash
migrate ... up
```

---

## ⚠️ Common Migration Rules

- Always create tables **before** altering them in later migrations
- Avoid `CREATE TYPE` without `IF NOT EXISTS` unless guaranteed new DB
- Do **not** modify old migration files once applied
- Use new migrations for all schema changes

---

## 🚀 Run the Backend Server

From the backend root:

```bash
go run cmd/server/main.go
```

The API server will start using the configuration from `.env`.

---

## ✅ Summary

- Database schema is managed **only via migrations**
- Sequential migration numbering is mandatory
- `schema.sql` is for reference only
- Always verify migration order and dependencies

---

Happy building 🎨🚀
