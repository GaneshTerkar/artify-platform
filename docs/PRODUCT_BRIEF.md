# Product brief: Portrait sketch ordering platform

See the canonical brief in project planning docs. Stack: **Go (Gin)**, **React (Vite + TypeScript)**, **PostgreSQL**.

---

## 📊 Implementation Status

| Area | Status | Notes |
|:-----|:------:|:------|
| **Backend Auth & Users** | ✅ Complete | JWT authentication, bcrypt passwords, `/auth/register`, `/auth/login`, `/api/me` |
| **Artist Management** | ✅ Complete | Artist profiles, review queue, admin verify/reject workflows |
| **Dynamic Paintings Gallery** | ✅ Complete | Database-driven (`artist_paintings` + completed orders), authentic categories (`PENCIL`, `CHARCOAL`, `WATERCOLOR`, `ACRYLIC`, `OIL`), migration seed (`010_seed_gallery_paintings.up.sql`) |
| **Orders API (`/api/v1/orders`)** | ✅ Complete | Order placement, customer order history, status updates, order notes |
| **Products & Pricing Engine** | ✅ Complete | Medium-based pricing, size multipliers, dynamic price estimate endpoint (`/api/v1/products/price/estimate`) |
| **File Uploads (`/api/v1/upload`)** | ✅ Complete | Local disk storage (`/uploads`) and S3 / MinIO integration |
| **Customer Device Photo Uploader**| ✅ Complete | Browser file picker from mobile/laptop/desktop, drag-and-drop, validation, thumbnail preview |
| **Gallery UI & Aspect Ratio** | ✅ Complete | 1:1 square artwork preview cards preventing horizontal clipping and preserving corner reference photos |
| **Guest to Order Auth Flow** | ✅ Complete | Guests can explore categorized artwork; checkout initiates seamless redirection to Login/Register |
| **Customer Account & Tracking** | ✅ Complete | Track order progress (`PLACED` &rarr; `CONFIRMED` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`) and view finished portraits |
| **Payments (Stripe)** | 🔄 Configured | Dev mock sessions and Stripe webhook stub; live webhook ready for keys |
| **Docker Compose** | ✅ Complete | PostgreSQL 16 container service with persistent volume |

---

## 🔄 Order Lifecycle

Order statuses use the PostgreSQL `order_status` enum:
- `PLACED`: Customer has configured the order and reference photo.
- `CONFIRMED`: Payment confirmed (or approved in development).
- `IN_PROGRESS`: Assigned artist is actively creating the portrait.
- `COMPLETED`: Artwork is finished and final image uploaded. Completed orders automatically appear in the public gallery!
- `CANCELLED`: Cancelled prior to fulfillment.
