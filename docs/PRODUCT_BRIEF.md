# Product brief: Portrait sketch ordering platform

See the canonical brief in project planning docs. Stack: **Go (Gin)**, **React (Vite + TypeScript)**, **PostgreSQL**.

---

## 📊 Implementation Status

| Area | Status | Notes |
|:-----|:------:|:------|
| **Backend Auth & Users** | ✅ Complete | JWT authentication, bcrypt passwords, `/auth/register`, `/auth/login`, `/api/me`, RBAC for 4 roles |
| **Artist Management** | ✅ Complete | Artist profiles, review queue, admin verify/reject workflows, verified artist roster |
| **Dynamic Paintings Gallery** | ✅ Complete | Database-driven (`artist_paintings` + published orders), authentic categories (`PENCIL`, `CHARCOAL`, `WATERCOLOR`, `ACRYLIC`, `OIL`) |
| **Orders API (`/api/v1/orders`)** | ✅ Complete | Order placement, multi-role status transitions, order notes, audit history logging |
| **Products & Pricing Engine** | ✅ Complete | Medium-based pricing, size multipliers, dynamic price estimate endpoint (`/api/v1/products/price/estimate`) |
| **Auto-Collage Engine** | ✅ Complete | Side-by-side comparison synthesis of reference photo & artist sketch upon completion |
| **Studio Quality Inspection** | ✅ Complete | Admin inspection modal with raw sketch, reference photo, and collage validation |
| **Delivery Partner Logistics** | ✅ Complete | Courier assignment (`ASSIGNED_DELIVERY_AGENT`), transit tracking (`IN_TRANSIT`, `OUT_FOR_DELIVERY`), failure retries (`DELIVERY_FAILED`), and doorstep handover (`DELIVERED`) |
| **Gallery Publishing Gate** | ✅ Complete | Explicit Admin confirmation endpoint (`/confirm-gallery`), promoting delivered collages to public discovery |
| **File Uploads (`/api/v1/upload`)** | ✅ Complete | Local disk storage (`/uploads`) and S3 / MinIO integration |
| **Customer Device Photo Uploader**| ✅ Complete | Browser file picker from mobile/laptop/desktop, drag-and-drop, validation, thumbnail preview |
| **Gallery UI & Aspect Ratio** | ✅ Complete | 1:1 square artwork preview cards preventing horizontal clipping and preserving corner reference photos |
| **Guest to Order Auth Flow** | ✅ Complete | Guests can explore categorized artwork; checkout initiates seamless redirection to Login/Register |
| **Multi-Role Dashboards** | ✅ Complete | Customer live timeline tracking, Artist commission workbench, Courier transit portal, Admin management hub |
| **Payments (Manual + Razorpay)** | ✅ Complete | Manual admin-confirmed checkout (portable default), Razorpay test/live checkout, signed idempotent webhook, full refunds, and safety guards |
| **Docker Compose** | ✅ Complete | PostgreSQL 16 container service with persistent volume |

---

## 🔄 Multi-Role Order Lifecycle

Order statuses use the PostgreSQL `order_status` enum:
- `PLACED`: Customer has configured the order and reference photo.
- `CONFIRMED`: Payment confirmed by Admin or payment gateway.
- `ASSIGNED_ARTIST`: Admin assigned a verified portrait artist.
- `IN_PROGRESS`: Assigned artist is actively creating the physical portrait.
- `COMPLETED`: Artwork completed; raw sketch uploaded; system automatically synthesizes comparison collage (`is_published_to_gallery = false`).
- `ASSIGNED_DELIVERY_AGENT`: Admin reviewed artwork and assigned a verified courier partner.
- `IN_TRANSIT`: Courier picked up parcel from studio and initiated dispatch.
- `OUT_FOR_DELIVERY`: Courier is en route to the recipient address.
- `DELIVERY_FAILED`: Courier recorded delivery exception with reason; eligible for re-attempt.
- `DELIVERED`: Physical handover to customer confirmed at doorstep.
- `PUBLISHED`: Admin reviewed delivered artwork and approved public showcase; artwork now live in Public Art Gallery.
- `CANCELLED`: Order cancelled prior to fulfillment.
