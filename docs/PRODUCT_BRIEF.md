# Product brief: Portrait sketch ordering platform

See the canonical brief in project planning docs. Stack: **Go (Gin)**, **React (Vite + TypeScript)**, **PostgreSQL**.

Implementation status:

| Area | Status |
|------|--------|
| Backend auth, artists | Existing |
| Orders API (`/api/v1/orders`) | MVP |
| Products catalog (`/api/v1/products`) | MVP (enum-based pricing) |
| Payments (Stripe) | Config + stub checkout; webhook scaffold |
| React customer app | Scaffold + order wizard shell |
| Docker Compose (Postgres) | Added |

Order statuses use the existing PostgreSQL `order_status` enum (`PLACED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, …), mapped to the brief’s lifecycle in API responses.
