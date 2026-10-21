# Artify Platform &mdash; Complete API Documentation & Role Guide

This document contains full, executable documentation for all REST API endpoints in the **Artify Platform**. All endpoints are guarded by strict **Role-Based Access Control (RBAC)**. If an unauthorized role attempts to access an endpoint, the system rejects the request with a descriptive `403 Forbidden` message.

---

## 📑 Table of Contents

1. [Role-Based Access Control (RBAC) Overview](#1-role-based-access-control-rbac-overview)
2. [Role Validation & Error Responses](#2-role-validation--error-responses)
3. [Token Generation (Authentication)](#3-token-generation-authentication)
4. [Public APIs (No Auth Required)](#4-public-apis-no-auth-required)
5. [Customer APIs (`CUSTOMER`)](#5-customer-apis-customer)
6. [Artist APIs (`ARTIST`)](#6-artist-apis-artist)
7. [Delivery Agent APIs (`DELIVERY_AGENT`)](#7-delivery-agent-apis-delivery_agent)
8. [Admin APIs (`ADMIN`)](#8-admin-apis-admin)
9. [Quick Verification Script](#9-quick-verification-script)

---

## 1. Role-Based Access Control (RBAC) Overview

| Role | Permitted Actions |
| :--- | :--- |
| **`PUBLIC`** | Browse dynamic gallery, inspect product catalog, estimate custom order pricing. |
| **`CUSTOMER`** | Upload reference photos, configure and create portrait orders, view personal order history, live delivery tracking, checkout with manual mock or Razorpay, verify a Razorpay payment. |
| **`ARTIST`** | View/update artist profile, submit artwork portfolio, view assigned orders, update order status to `IN_PROGRESS` and `COMPLETED` with finished sketch, assign orders to verified artists. |
| **`DELIVERY_AGENT`** | View assigned delivery parcels, update parcel transit status (`IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED` with retry logs), decline assignment back to studio. |
| **`ADMIN`** | Review artist queue, approve/reject artists, view all customer orders, inspect completed collages, assign artists, confirm manual payments, assign delivery agents, update logistics/tracking, refund Razorpay payments, confirm public gallery publication, manage user roles and statuses. |

---

## 2. Role Validation & Error Responses

When a user tries to access an endpoint outside their permitted role, the backend rejects the request with HTTP **`403 Forbidden`**:

```json
{
  "error": "you are not allowed to perform this action with role 'CUSTOMER'. Required role: ADMIN"
}
```

```json
{
  "error": "you are not allowed to perform this action with role 'CUSTOMER'. Required role: ARTIST"
}
```

```json
{
  "error": "you are not allowed to perform this action: orders can only be assigned to a verified artist"
}
```

---

## 3. Token Generation (Authentication)

### 3.1 Register User (`POST /auth/register`)
Create a new user account. Role defaults to `CUSTOMER` if omitted.

- **URL**: `http://localhost:8080/auth/register`
- **Method**: `POST`
- **Access**: Public
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "full_name": "John Doe",
  "email": "customer@example.com",
  "password": "password123",
  "address": "123 Art Street, Pune",
  "phone_number": "+919876543210",
  "role": "CUSTOMER"
}
```
*(To register as an artist, set `"role": "ARTIST"`)*

#### Success Response (`201 Created`)
```json
{
  "user": {
    "user_id": "a1b2c3d4-...",
    "full_name": "John Doe",
    "email": "customer@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE"
  }
}
```

---

### 3.2 Login & Token Generation (`POST /auth/login`)
Authenticate user credentials and receive a signed JWT token containing the user's role and ID.

- **URL**: `http://localhost:8080/auth/login`
- **Method**: `POST`
- **Access**: Public
- **Headers**: `Content-Type: application/json`

#### Request Body (Customer, Artist, or Admin)
```json
{
  "email": "ganesh@example.com",
  "password": "password123"
}
```

#### Success Response (`200 OK`)
```json
{
  "Token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "User": {
    "user_id": "18c95f7b-5c75-4d5f-8b79-cfe4c6b5df2d",
    "full_name": "Ganesh Terkar",
    "email": "ganesh@example.com",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

> [!TIP]
> Include the returned token in the `Authorization` header for all subsequent protected requests:
> ```http
> Authorization: Bearer <Token>
> ```

---

## 4. Public APIs (No Auth Required)

### 4.1 Health Check
```bash
curl -X GET http://localhost:8080/health
```
**Response**: `{"status": "ok"}`

### 4.2 Dynamic Paintings Gallery
Returns all authentic paintings and completed orders from verified artists. Supports optional category filtering (`?category=PENCIL`).

```bash
curl -X GET "http://localhost:8080/api/v1/paintings?category=CHARCOAL"
```

### 4.3 Products Catalog
Returns base portrait products and dimensions.
```bash
curl -X GET http://localhost:8080/api/v1/products
```

### 4.4 Dynamic Price Estimate
Calculates estimated price in real-time based on medium, dimensions, and number of faces.
```bash
curl -X GET "http://localhost:8080/api/v1/products/price/estimate?medium=PENCIL&size=A3&faces=2"
```

### 4.5 Razorpay Webhook (`POST /webhooks/razorpay`)
Public endpoint (no JWT), but every request must include a valid `X-Razorpay-Signature` — HMAC-SHA256 of the **raw body** using `RAZORPAY_WEBHOOK_SECRET`. The route is at the server root, **not** under `/api/v1`.

Supported events: `payment.captured`, `order.paid`, `payment.failed`, `refund.created`, `refund.processed`. `payment.authorized` is captured explicitly when auto-capture is disabled. Duplicate `X-Razorpay-Event-Id` values are ignored, and processing is idempotent.

```bash
curl -X POST http://localhost:8080/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: <hmac-sha256-hex>" \
  -H "X-Razorpay-Event-Id: evt_test_1" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_...",
          "order_id": "order_...",
          "amount": 450000,
          "currency": "INR",
          "status": "captured",
          "method": "card"
        }
      }
    }
  }'
```

> [!NOTE]
> Localhost cannot receive real Razorpay deliveries because Razorpay requires a public HTTPS URL. Use a manually computed signature to test locally; the Postman collection (folder 07) signs the body for you. A `503` means Razorpay is not configured.

---

## 5. Customer APIs (`CUSTOMER`)

Header required: `Authorization: Bearer <CUSTOMER_TOKEN>`

### 5.1 Current User Session (`GET /api/me`)
```bash
curl -X GET http://localhost:8080/api/me \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>"
```
**Response**:
```json
{
  "user_id": "28f23beb-...",
  "role": "CUSTOMER",
  "status": "ACTIVE"
}
```

### 5.2 Upload Reference Photo (`POST /api/v1/upload`)
Upload customer photo from local device (JPG, PNG, WebP up to 10MB).
```bash
curl -X POST http://localhost:8080/api/v1/upload \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" \
  -F "file=@/path/to/reference_photo.jpg"
```
**Response**:
```json
{
  "file_url": "/uploads/12345678-uuid.jpg"
}
```

### 5.3 Create Portrait Order (`POST /api/v1/orders`)
```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "painting_category": "PENCIL",
    "size": "A3",
    "persons_included": "COUPLE",
    "reference_image_url": "/uploads/12345678-uuid.jpg",
    "delivery_address": "123 MG Road, Pune, Maharashtra",
    "customer_notes": "Please highlight the eyes and add subtle shading."
  }'
```

### 5.4 List My Orders (`GET /api/v1/orders`)
```bash
curl -X GET http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>"
```

### 5.5 Checkout Order (`POST /api/v1/orders/:id/checkout`)
Starts payment for an order in `PLACED`. The **server** chooses the provider from `PAYMENT_PROVIDER`; the client never sends the amount.

| Mode | Required configuration | Behaviour |
| :--- | :--- | :--- |
| `manual` (portable default) | `PAYMENT_PROVIDER=manual` | Returns a mock `checkout_url` and records a local payment. **No money moves.** The order stays `PLACED` until an admin confirms it. |
| `razorpay` test | `PAYMENT_PROVIDER=razorpay`, `PAYMENTS_LIVE=false`, `rzp_test_...` keys and `RAZORPAY_WEBHOOK_SECRET` | Returns the fields for Razorpay Checkout.js. Test cards/UPI move **no real money** and need no KYC. |
| `razorpay` live | `PAYMENT_PROVIDER=razorpay`, `PAYMENTS_LIVE=true`, `rzp_live_...` keys | **Real money.** Requires KYC and a public HTTPS webhook; the portable/localhost build is not suitable. |

```bash
curl -X POST http://localhost:8080/api/v1/orders/<ORDER_ID>/checkout \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>"
```

Manual response:
```json
{
  "provider": "manual",
  "order_id": "...",
  "amount": 4500,
  "currency": "INR",
  "payment_id": "...",
  "checkout_url": "http://localhost:5173/order/success?order_id=...",
  "session_id": "dev_session_..."
}
```

Razorpay response:
```json
{
  "provider": "razorpay",
  "order_id": "...",
  "amount": 4500,
  "amount_paise": 450000,
  "currency": "INR",
  "payment_id": "...",
  "key_id": "rzp_test_...",
  "razorpay_order_id": "order_..."
}
```

`amount` is computed from `orders.total_price`; gateway checkout enforces `PAYMENT_MIN_AMOUNT`/`PAYMENT_MAX_AMOUNT`. The `payment_id` in the checkout response is the **local payment record**; Razorpay's provider payment ID (`pay_...`) arrives after Checkout.js completes. A `503` means the selected provider is not configured correctly, and the server refuses to start with unsafe combinations (for example a live key while `PAYMENTS_LIVE=false`).

### 5.6 Verify Razorpay Payment (`POST /api/v1/payments/verify`)
Called by the browser immediately after a successful Razorpay Checkout.js payment. The server verifies the HMAC signature and moves the order `PLACED -> CONFIRMED`. The signed webhook (4.5) is the fallback if the browser never returns.

```bash
curl -X POST http://localhost:8080/api/v1/payments/verify \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_...",
    "razorpay_payment_id": "pay_...",
    "razorpay_signature": "<signature-from-checkout>"
  }'
```

Success:
```json
{ "status": "paid", "order": { "status": "CONFIRMED" } }
```

Returns `503` in manual mode, `400` for a bad signature, and `404` if the order/payment does not belong to the caller. Confirmation is idempotent.

---

## 6. Artist APIs (`ARTIST`)

Header required: `Authorization: Bearer <ARTIST_TOKEN>`

### 6.1 View Artist Profile (`GET /api/artist/profile/view`)
```bash
curl -X GET http://localhost:8080/api/artist/profile/view \
  -H "Authorization: Bearer <ARTIST_TOKEN>"
```
*If a `CUSTOMER` calls this endpoint, the backend returns:*
```json
{
  "error": "you are not allowed to perform this action with role 'CUSTOMER'. Required role: ARTIST"
}
```

### 6.2 Create/Update Artist Profile (`POST /api/artist/profile`)
```bash
curl -X POST http://localhost:8080/api/artist/profile \
  -H "Authorization: Bearer <ARTIST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Specialist in fine graphite pencil and expressive charcoal portraiture.",
    "experience_years": 7
  }'
```

### 6.3 Check Verification Status (`GET /api/artist/profile/review-status`)
```bash
curl -X GET http://localhost:8080/api/artist/profile/review-status \
  -H "Authorization: Bearer <ARTIST_TOKEN>"
```

### 6.4 Upload Portfolio Artwork (`POST /api/artist/paintings/add`)
```bash
curl -X POST http://localhost:8080/api/artist/paintings/add \
  -H "Authorization: Bearer <ARTIST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sunlit Portrait",
    "description": "Original graphite sketch",
    "category": "PENCIL",
    "image_url": "/uploads/sample_artwork.jpg"
  }'
```

### 6.5 Assign Order to Verified Artist (`POST /api/v1/orders/:id/assign`)
Verified artists can assign customer orders to other verified artists.
```bash
curl -X POST http://localhost:8080/api/v1/orders/<ORDER_ID>/assign \
  -H "Authorization: Bearer <ARTIST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "artist_id": "<VERIFIED_ARTIST_UUID>"
  }'
```
*If the assigned artist is unverified, the backend returns:*
```json
{
  "error": "you are not allowed to perform this action: orders can only be assigned to a verified artist"
}
```

### 6.6 List Available Verified Artists (`GET /api/v1/artists/verified`)
```bash
curl -X GET http://localhost:8080/api/v1/artists/verified \
  -H "Authorization: Bearer <ARTIST_TOKEN>"
```

---

## 7. Delivery Agent APIs (`DELIVERY_AGENT`)

Header required: `Authorization: Bearer <DELIVERY_AGENT_TOKEN>`

### 7.1 View Assigned Delivery Parcels (`GET /api/v1/orders`)
Returns all parcels assigned to the authenticated delivery agent.
```bash
curl -X GET http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer <DELIVERY_AGENT_TOKEN>"
```

### 7.2 Update Delivery Transit Status (`PATCH /api/v1/orders/:id/status`)
Allows assigned delivery agents to transition parcel states:
- `IN_TRANSIT`: Parcel picked up from studio / in dispatch.
- `OUT_FOR_DELIVERY`: Parcel en route to doorstep.
- `DELIVERED`: Physical handover confirmed with customer.
- `DELIVERY_FAILED`: Exception encountered (e.g. customer unavailable, incorrect address).

```bash
# Accept parcel and mark in transit
curl -X PATCH http://localhost:8080/api/v1/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <DELIVERY_AGENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_TRANSIT"
  }'

# Mark out for delivery
curl -X PATCH http://localhost:8080/api/v1/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <DELIVERY_AGENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "OUT_FOR_DELIVERY"
  }'

# Confirm doorstep delivery
curl -X PATCH http://localhost:8080/api/v1/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <DELIVERY_AGENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DELIVERED"
  }'

# Log delivery failure with retry attempt
curl -X PATCH http://localhost:8080/api/v1/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <DELIVERY_AGENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DELIVERY_FAILED",
    "delivery_failure_reason": "Customer premises locked / phone unreachable"
  }'
```

---

## 8. Admin APIs (`ADMIN`)

Header required: `Authorization: Bearer <ADMIN_TOKEN>`

### 8.1 View Artist Review Queue (`GET /api/admin/artists/review-queue`)
Lists all artists awaiting review and approval.
```bash
curl -X GET http://localhost:8080/api/admin/artists/review-queue \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.2 Verify / Approve Artist (`POST /api/admin/verify-artist/:id`)
Approves an artist, setting `artist_profiles.verified = true` and activating their account.
```bash
curl -X POST http://localhost:8080/api/admin/verify-artist/<ARTIST_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.3 Reject Artist (`POST /api/admin/reject-artist/:id`)
Rejects an unapproved artist with a mandatory reason.
```bash
curl -X POST http://localhost:8080/api/admin/reject-artist/<ARTIST_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Please provide clearer sample images with higher resolution."
  }'
```

### 8.4 List All Platform Orders (`GET /api/v1/admin/orders`)
Lists all customer orders with optional status filter (`?status=PLACED`).
```bash
curl -X GET "http://localhost:8080/api/v1/admin/orders?status=PLACED" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.5 Update Order Status & Complete Artwork (`PATCH /api/v1/admin/orders/:id/status`)
Allows admin to transition order status and upload final artwork.
```bash
curl -X PATCH http://localhost:8080/api/v1/admin/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED",
    "final_image_url": "/paintings/final_portrait.jpg"
  }'
```
> [!NOTE]
> When an order is transitioned to `COMPLETED`, the system automatically synthesizes a high-resolution side-by-side comparison collage (`collage_image_url`). However, the artwork **remains private** (`is_published_to_gallery = false`) until courier delivery and Admin confirmation.

### 8.6 Confirm Manual Payment (`POST /api/v1/orders/:id/confirm-payment`)
ADMIN-only fallback for manual mode (`PLACED -> CONFIRMED`). In Razorpay mode the signed webhook or **Verify Razorpay payment** confirms automatically; use this only when a manual payment was received outside the gateway.
```bash
curl -X POST http://localhost:8080/api/v1/orders/<ORDER_ID>/confirm-payment \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.7 Assign Delivery Partner (`POST /api/v1/admin/orders/:id/assign-delivery`)
Assigns a verified delivery agent to a completed or in-delivery order.
```bash
curl -X POST http://localhost:8080/api/v1/admin/orders/<ORDER_ID>/assign-delivery \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery_agent_id": "<DELIVERY_AGENT_UUID>"
  }'
```
> Re-assigning while the order is already `IN_TRANSIT` or `OUT_FOR_DELIVERY` changes only the courier and **preserves the current status**, so the customer does not see the delivery step rewind. Assigning from `COMPLETED` or `DELIVERY_FAILED` sets `ASSIGNED_DELIVERY_AGENT`.

### 8.8 Update Logistics & Tracking (`PATCH /api/v1/admin/orders/:id/logistics`)
Adds or updates courier details, the AWB/tracking number, ETA and dispatch notes. This does **not** change the order status.
```bash
curl -X PATCH http://localhost:8080/api/v1/admin/orders/<ORDER_ID>/logistics \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "courier_partner": "Blue Dart",
    "tracking_number": "BD123456789IN",
    "estimated_delivery_at": "2026-10-25T10:00:00Z",
    "admin_dispatch_notes": "Handle the artwork with care."
  }'
```
> The customer sees these values in **My Orders**. A tracking button is generated only for Blue Dart, Delhivery and DTDC; other/in-house couriers show the AWB without a fabricated tracking link. All fields are optional; omitted fields are left unchanged.

### 8.9 List Active Delivery Partners (`GET /api/v1/admin/delivery-agents`)
Lists all active delivery agents available for courier dispatch.
```bash
curl -X GET http://localhost:8080/api/v1/admin/delivery-agents \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.10 Confirm & Publish Artwork to Public Gallery (`POST /api/v1/admin/orders/:id/confirm-gallery`)
Admin quality inspection approval. Promotes the delivered artwork's comparison collage to the Public Art Gallery (`/gallery`), setting `is_published_to_gallery = true` and status `PUBLISHED`.
```bash
curl -X POST http://localhost:8080/api/v1/admin/orders/<ORDER_ID>/confirm-gallery \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.11 Refund Razorpay Payment (`POST /api/v1/admin/orders/:id/refund`)
Issues a **full** refund for a captured Razorpay payment. The order must have a `PAID` Razorpay payment; manual payments return `400`. Partial refunds are not supported. In live mode this moves real money.
```bash
curl -X POST http://localhost:8080/api/v1/admin/orders/<ORDER_ID>/refund \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Success response:
```json
{ "status": "refunded", "refund_id": "rfnd_...", "order_id": "..." }
```

### 8.12 Platform User Management (`GET /api/v1/admin/users`, `PATCH status`, `PATCH role`)
```bash
# List all platform users with role counts
curl -X GET http://localhost:8080/api/v1/admin/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Update user status (ACTIVE, SUSPENDED)
curl -X PATCH http://localhost:8080/api/v1/admin/users/<USER_ID>/status \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "ACTIVE" }'

# Elevate user to ARTIST
curl -X PATCH http://localhost:8080/api/v1/admin/users/<USER_ID>/role \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "role": "ARTIST" }'
```

---

## 9. Quick Verification Script

You can run this Node.js script to test role validation directly from the command line:

```javascript
// test_roles.js
async function testRoles() {
  // 1. Login as Admin
  const adminRes = await fetch('http://localhost:8080/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ganesh@example.com', password: 'password123' })
  });
  const { Token: adminToken } = await adminRes.json();

  // 2. Access Admin Endpoint with Admin Token -> 200 OK
  const ordersRes = await fetch('http://localhost:8080/api/v1/admin/orders', {
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  console.log('Admin accessing Admin endpoint:', ordersRes.status); // 200

  // 3. Register Customer & Attempt Admin Access -> 403 Forbidden
  const custEmail = 'test_' + Date.now() + '@example.com';
  await fetch('http://localhost:8080/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Test Customer',
      email: custEmail,
      password: 'password123',
      address: 'Pune',
      phone_number: '+919999999999',
      role: 'CUSTOMER'
    })
  });
  const custRes = await fetch('http://localhost:8080/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custEmail, password: 'password123' })
  });
  const { Token: customerToken } = await custRes.json();

  const deniedRes = await fetch('http://localhost:8080/api/v1/admin/orders', {
    headers: { 'Authorization': 'Bearer ' + customerToken }
  });
  console.log('Customer accessing Admin endpoint:', deniedRes.status); // 403
  console.log('Rejection message:', await deniedRes.json());
}
testRoles();
```
