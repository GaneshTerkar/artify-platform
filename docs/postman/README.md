# ArtifyMe Postman Collection

Ready-to-import Postman files for the ArtifyMe API, with the existing accounts already filled in.

| File | Purpose |
| :--- | :--- |
| `ArtifyMe.postman_collection.json` | 87 requests grouped by role, with automatic token capture |
| `ArtifyMe.postman_environment.json` | `baseUrl`, credentials, user IDs, demo order IDs and payment-test variables |

---

## Import & quick start

1. Open Postman -> **Import** -> select **both** JSON files.
2. Select the **ArtifyMe - Local (portable)** environment in the top-right selector.
3. Open **00 - Authentication & Tokens** and send the four existing-user login requests. Each one saves its JWT automatically:
   - `adminToken`
   - `admin2Token`
   - `customerToken`
   - `artistToken`
4. Send **Sync demo order IDs** and **Sync user IDs** (bottom of the same folder). These pull the current UUIDs from the live database. **Run them again after any re-seed.**
5. Open any role folder and send requests. Authorization is already wired at folder level.
6. For the courier flow, send **Login - DELIVERY AGENT**. The `courier.vikram@example.com` account already exists in the portable database; on a fresh database, send **Register - DELIVERY AGENT** first, then optionally **05 -> ADMIN -> Activate delivery agent**.
7. To exercise artist verification: **Register - ARTIST** -> **Login - NEW ARTIST** -> **03 -> Add painting as NEW artist** -> **05 -> ADMIN -> Verify artist**.

No manual copy/paste of tokens is required.

---

## Payments

The **server** chooses the payment provider from `app\.env` (portable) or `artifyme-backend\.env` (dev). Postman calls the endpoints; it cannot switch the mode.

| Mode | Configuration | What happens |
| :--- | :--- | :--- |
| **Manual** (portable default) | `PAYMENT_PROVIDER=manual` | Checkout returns `200` with a mock `checkout_url`; **no money moves**. The order stays `PLACED` until an admin sends **05 → Confirm payment**. |
| **Razorpay test** | `PAYMENT_PROVIDER=razorpay`, `PAYMENTS_LIVE=false`, `rzp_test_…` keys and a webhook secret | Test cards/UPI move **no real money** and need no KYC. The browser **Verify** request or the signed webhook confirms the order. |
| **Razorpay live** | `PAYMENT_PROVIDER=razorpay`, `PAYMENTS_LIVE=true`, `rzp_live_…` keys | **Real money.** Requires KYC and a public HTTPS webhook. The portable/localhost build is not suitable. |

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/orders/:id/checkout` | Customer | Start manual mock checkout or create a Razorpay order |
| `POST` | `/api/v1/payments/verify` | Customer | Verify the Checkout.js signature and confirm the order |
| `POST` | `/webhooks/razorpay` | Public, signature required | `payment.captured`, `payment.failed`, `refund.*` events |
| `POST` | `/api/v1/admin/orders/:id/refund` | Admin | Full refund of a captured Razorpay payment |

Relevant server variables: `PAYMENT_PROVIDER`, `PAYMENTS_LIVE`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_MIN_AMOUNT`, `PAYMENT_MAX_AMOUNT`. The server refuses unsafe combinations (live key with `PAYMENTS_LIVE=false`, test key with `PAYMENTS_LIVE=true`, missing webhook secret) and rejects amounts outside the configured limits.

### Testing Razorpay test mode safely

1. Create free **test-mode** keys in the Razorpay dashboard (`rzp_test_…`). Test mode needs no KYC.
2. In `app\.env`, set `PAYMENT_PROVIDER=razorpay`, `PAYMENTS_LIVE=false`, the test key pair and any `RAZORPAY_WEBHOOK_SECRET`; restart ArtifyMe.
3. Send **00 → Login · CUSTOMER**, then **02 → Checkout** on a `PLACED` order. The test script saves `razorpayOrderId` and `paymentAmountPaise`.
4. Pay with a Razorpay test card/UPI in the storefront. To verify from Postman instead, paste the `razorpay_payment_id` and `razorpay_signature` from the Checkout.js callback into the environment and send **02 → Verify Razorpay payment**.
5. For a refund, set `orderId` to the paid order and send **05 → Refund Razorpay payment**. This is a full refund only; in live mode it moves real money.
6. For the webhook, set `razorpayWebhookSecret` in the Postman environment, put a **provider** payment ID in `razorpayPaymentId`, and send **07 → Razorpay webhook**. The request signs the body itself. Localhost cannot receive real Razorpay deliveries; this only tests local signature handling.

`503` from checkout/verify means the selected provider is not configured correctly. In manual mode, verify/refund/webhook are expected to return `503` (gateway disabled) or `400` (manual payment), which the test scripts accept.

---

## Existing users - currently running app

The portable edition serves the API at **`http://localhost:8080`**. Its database contains these accounts, and all of them were tested against `POST /auth/login`:

| Role | Name | Email | Password | User ID |
| :--- | :--- | :--- | :--- | :--- |
| `ADMIN` | Ganesh Terkar | `ganesh@example.com` | `password123` | `11111111-1111-4111-8111-111111111111` |
| `ADMIN` | Admin Tester | `testadmin2@artifyme.com` | `password123` | `22222222-2222-4222-8222-222222222222` |
| `CUSTOMER` | Priya Patel | `priya.customer@example.com` | `password123` | `17c74a5c-ab7e-495c-a214-6bf48ce94377` |
| `ARTIST` | Rohan Sharma (verified) | `rohan.artist@example.com` | `password123` | `591fe88e-a0d2-40e2-8edf-f184bded8c3f` |
| `DELIVERY_AGENT` | Vikram Courier (created by the collection, `PENDING`) | `courier.vikram@example.com` | `password123` | `e39a0201-5fde-4758-b80f-edb4dcd22fa8` |

> The demo seed does not create a courier. The collection includes a one-click **Register - DELIVERY AGENT** request; the portable database used for this validation already has the courier account above. Use **05 -> ADMIN -> Activate delivery agent** to move it to `ACTIVE`.

### Preloaded demo orders

| Variable | Status | Order ID (current at last sync) |
| :--- | :--- | :--- |
| `orderIdPlaced` | `PLACED` | `f8631526-c47f-424b-9688-3bba183cd4e9` |
| `orderIdConfirmed` | `CONFIRMED` | `97e119b4-25f3-47ba-9dfc-629bf29ec7bb` |
| `orderIdAssigned` | `ASSIGNED_ARTIST` | `7ed65d4b-bcc7-4c1e-876d-02fa584c71be` |
| `orderIdInProgress` | `IN_PROGRESS` | `418324c3-7485-4937-9f3d-f1833ee4daaa` |
| `orderIdCompleted` | `COMPLETED` (not published) | `f6cd860d-de00-4c50-b791-0407bd784235` |
| `orderIdPublished` | `PUBLISHED` | `09100d2b-ba2b-4735-9b88-1d520a61c81f` |

Reset the demo data with `D:\ArtifyMe\artifyme-portable\app\artifyme-seed.exe` (run it from the `app` folder). Re-seeding changes order UUIDs, so run **Sync demo order IDs** again afterwards - the collection updates itself.

---

## What is in the collection

| Folder | Contents |
| :--- | :--- |
| **00 - Authentication & Tokens** | 4 seeded-user logins, demo-ID sync, courier/artist/customer registration, refresh token, sessions |
| **01 - Public APIs** | Health, gallery, products, price estimate, public reviews |
| **02 - CUSTOMER APIs** | Profile, upload, create order, list/get/patch order, checkout/verify, reviews |
| **03 - ARTIST APIs** | Profile, review status, portfolio, assigned orders, status transitions |
| **04 - DELIVERY AGENT APIs** | Assigned parcels and `IN_TRANSIT` -> `OUT_FOR_DELIVERY` -> `DELIVERED` transitions |
| **05 - ADMIN APIs** | Orders, users, artist verification, assignment, logistics, refunds, gallery publish, reviews, stats |
| **06 - RBAC Negative Tests** | Expected `401`/`403` checks |
| **07 - PAYMENT WEBHOOKS** | Signed hand-crafted Razorpay webhook for local signature/processing tests |

Requests that change data are marked **MUTATES**. Test scripts also save new IDs (`orderId`, `newOrderId`, `reviewId`, `uploadedFileUrl`) as you use them.

### Validation status

- All 5 logins (4 seeded users + courier) returned `200` and saved their JWTs.
- Both sync requests returned `200` and populated every user/order ID.
- All 46 GET requests passed, including the expected `401`/`403` negative tests.
- **Checkout is provider-aware.** In manual mode (portable default) it returns `200` and no money moves; an admin confirms with **Confirm payment**. Razorpay mode needs `rzp_test_…` keys, and `503` means the provider is misconfigured.
- The offline payment flow (checkout, signed webhook, duplicate/tampered events, failed payment, browser verify, admin refund, live-key guard) is covered by `artifyme-backend\scripts\e2e-payments.ps1`; it needs no Razorpay account or network.

---

## Alternate dev database on port 5432

If you start the repository backend against your local development PostgreSQL on **port 5432** (the `.env` in `artifyme-backend`), these additional accounts exist. Their passwords are standardized to **`password123`**, the same as the portable accounts. All logins were verified after the reset.

| Role | Email | Password | User ID |
| :--- | :--- | :--- | :--- |
| `ADMIN` | `terkarganesh2709@gmail.com` | `password123` | `18c95f7b-5c75-4d5f-8b79-cfe4c6b5df2d` |
| `ADMIN` | `testadmin2@artifyme.com` | `password123` | `ec678c71-8f4c-41ce-b646-db0b91f94760` |
| `ARTIST` | `testartist@artifyme.com` (verified) | `password123` | `66e638d1-22ea-45e2-8859-feddd5c1e4e4` |
| `ARTIST` | `priya.artist@artifyme.local` | `password123` | `95952c3a-5290-445b-a656-951067a6e8a7` |
| `ARTIST` | `rohan.artist@artifyme.local` | `password123` | `7e34649f-c737-4f80-b374-2396829ba50e` |
| `CUSTOMER` | `aarav.customer@artifyme.local` | `password123` | `c279ac77-80c1-4fc7-b24d-9248410e82ee` |
| `CUSTOMER` | `aartiterkar@gmail.com` | `password123` | `9406618d-c0d4-47ab-a762-7c29dc367aa8` |
| `DELIVERY_AGENT` | `suresh.courier@artifyme.local` | `password123` | `3c9248d3-7b1b-4e82-b64b-3e26419127f9` |
| `DELIVERY_AGENT` | `vikram.courier@artifyme.local` | `password123` | `88cb0408-8ebb-489e-9042-4b6204803f3c` |

The 5432 database also has a `ganesh@example.com` admin (ID `5d10c1a1-803a-44e2-9631-a56c5ad3f0a3`). It now uses `password123` too, but its UUID and orders differ from the portable copy.

To use those accounts, change the `adminEmail` / `customerEmail` / etc. variables in the Postman environment. The password stays `password123`, but run **Sync demo order IDs** because the port-5432 database has different orders.

> All known local demo/test accounts, including `aartiterkar@gmail.com`, now use `password123`.

---

## Notes

- Tokens expire after 24 hours. Re-send the login requests whenever an authenticated request returns `401`.
- Checkout returns `200` in manual mode (portable default). Razorpay test mode requires test keys; `503` means the provider is not configured.
- Real Razorpay webhooks need a public HTTPS URL, so they cannot reach localhost. Use **07 → Razorpay webhook** to test signature handling locally.
- Payment requests are safe in manual/test mode. **Live keys with `PAYMENTS_LIVE=true` charge real money**, and an admin refund moves real money back.
- Requests that are already in a later lifecycle state return `400`/`409`; the collection treats those as handled, not failures.
- The environment was exported with validation JWTs. They are sensitive and may be expired; clear them before sharing or committing. The login requests repopulate them.
- Swagger UI for the running API: <http://localhost:8080/swagger/index.html>
