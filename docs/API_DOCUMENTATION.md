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
7. [Admin APIs (`ADMIN`)](#7-admin-apis-admin)
8. [Quick Verification Script](#8-quick-verification-script)

---

## 1. Role-Based Access Control (RBAC) Overview

| Role | Permitted Actions |
| :--- | :--- |
| **`PUBLIC`** | Browse dynamic gallery, inspect product catalog, estimate custom order pricing. |
| **`CUSTOMER`** | Upload reference photos, configure and create portrait orders, view personal order history, proceed to checkout. |
| **`ARTIST`** | View/update artist profile, submit artwork portfolio, view assigned orders, assign orders to verified artists. |
| **`ADMIN`** | Review artist queue, approve/reject artists, view all customer orders, update order statuses, assign artists. |

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
```bash
curl -X POST http://localhost:8080/api/v1/orders/<ORDER_ID>/checkout \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>"
```

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

## 7. Admin APIs (`ADMIN`)

Header required: `Authorization: Bearer <ADMIN_TOKEN>`

### 7.1 View Artist Review Queue (`GET /api/admin/artists/review-queue`)
Lists all artists awaiting review and approval.
```bash
curl -X GET http://localhost:8080/api/admin/artists/review-queue \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
*If a `CUSTOMER` or `ARTIST` calls this endpoint, the backend returns:*
```json
{
  "error": "you are not allowed to perform this action with role 'CUSTOMER'. Required role: ADMIN"
}
```

### 7.2 Verify / Approve Artist (`POST /api/admin/verify-artist/:id`)
Approves an artist, setting `artist_profiles.verified = true` and activating their account.
```bash
curl -X POST http://localhost:8080/api/admin/verify-artist/<ARTIST_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 7.3 Reject Artist (`POST /api/admin/reject-artist/:id`)
Rejects an unapproved artist with a mandatory reason.
```bash
curl -X POST http://localhost:8080/api/admin/reject-artist/<ARTIST_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Please provide clearer sample images with higher resolution."
  }'
```

### 7.4 List All Platform Orders (`GET /api/v1/admin/orders`)
Lists all customer orders with optional status filter (`?status=PLACED`).
```bash
curl -X GET "http://localhost:8080/api/v1/admin/orders?status=PLACED" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 7.5 Update Order Status & Complete Artwork (`PATCH /api/v1/admin/orders/:id/status`)
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
*(When marked `COMPLETED`, the painting automatically appears in the public gallery!)*

---

## 8. Quick Verification Script

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
