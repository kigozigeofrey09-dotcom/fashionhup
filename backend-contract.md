# FashionHub Backend Contract

This contract records the API paths currently wired in `src/services/` and `backend/src/`. Run the migrations listed in README against the connected Supabase project before expecting live rows. Development seeds are browse-only and marked `isSeed: true` / `SAMPLE`.

## Database foundation

Migrations `202610100001` through `202610110007` define listings, saved items, order requests, enquiries, private buyer/seller message threads, notifications, account preferences, deletion requests, and RLS policies. Applying SQL to Supabase is a separate step; the project cannot confirm from source files which migrations are already applied remotely.

The migration expects existing core tables to have `profiles(id)`, `shops(id, owner_id)`, and `listings(id, shop_id)` with UUID identifiers. Confirm these names and types in Supabase before applying it. `account_roles` is intentionally client read-only so users cannot grant themselves a seller or admin role; role assignment must be handled by a trusted backend flow. Direct client updates to order state are not granted; order transitions must use a backend endpoint that checks the current state and acting participant.

Photos currently use local PC disk storage and are served by the backend. This is for development and needs durable hosted storage before production deployment.

## Transport and common rules

- Configure `VITE_API_BASE_URL` with the backend origin plus API prefix. `.env.example` contains only a host placeholder.
- Services send JSON with `Accept: application/json`, credentials via secure same-site cookies, and `Content-Type: application/json` for JSON mutations. Receipt submission uses multipart `FormData`.
- Standard error shape: `{ "message": string, "details"?: Record<string,string> }`. Use `401` for unauthenticated, `403` for forbidden, `404` for unavailable resources/routes, `422` for validation and `5xx` for server errors.
- Authentication passwords are sent only to the FashionHub backend (HTTPS in deployment) and are passed to Supabase Auth; FashionHub never stores them. Never accept/store a mobile-money PIN or OTP. Use secure HTTP-only cookies, CSRF protections and rate limits.
- The front end role gate is a usability aid only. Enforce every role, ownership and access check on the backend.

## Shared types

- `AccountRole`: `buyer | seller | admin`.
- `Country`: `{ code, name, currency, cities, paymentInstructions? }`.
- `Listing`: includes `id`, `shopId`, `shopName`, `name`, `category`, `type`, `description`, `price`, `currency`, `countryCode`, `countryName`, `city`, `image`, optional product/service details, optional seller WhatsApp contact, optional `promotionLabel: Featured | Sponsored`, and optional `isSeed`.
- `Shop`: includes identity, categories, `sellType`, country/city, visual configuration, public `whatsappNumber`, and optional subscription state/promotion label.
- New subscription state must be `pending_verification` (or compatible `pending`) until an admin decision. `approved`, `declined`, `expired` and `cancelled` must be created only through authoritative server processes.

## Authentication service

- `GET /auth/session` → `{ user: User }`; returns `401` with no active session.
- `POST /auth/sign-up-password` buyer/seller only: `{ name, email, password, role, countryCode }` → non-enumerating status; Supabase sends an email-confirmation link. The backend validates allowed roles and email.
- `POST /auth/sign-in`: `{ email, password, role }` → verified Supabase session in secure HTTP-only cookies. The backend enforces role selection.
- `POST /auth/sign-in-link` and `/auth/sign-up` remain available for the email-link flow; never accept a PIN or OTP.
- `POST /auth/password/forgot`: `{ email }` → generic message that does not disclose account existence.
- `POST /auth/password/reset/confirm`: `{ password }` → validates the recovery session cookie and changes the password with Supabase Auth.
- `POST /auth/sign-out` → `204` and invalidate the secure session.
- `GET /auth/me` → authenticated user `{ id, name, email, role, countryCode? }`.

## Country and currency service

- `GET /countries` → `Country[]` available to marketplace and seller forms.
- `GET /admin/countries` → full country/currency directory; **admin** only.
- `POST /admin/countries`: `{ code, name, currency, cities[] }` → created country; **admin** only.
- `PUT /admin/countries/:code/currency`: `{ currency }` → updated country; **admin** only.
- `PUT /admin/countries/:code/payment-instructions`: `{ paymentInstructions }` → updated country; **admin** only.
- Country prices must be returned with the configured currency code. The client performs no exchange-rate conversion.
- Uganda manual payment instructions are `0773927881` for Uganda only. Other country instructions are separate admin-managed values. The backend must not copy Uganda instructions into another country.

## Marketplace search service

- `GET /listings?country=&city=&category=&type=&q=&sort=` → `Listing[]`; filters are optional and composable.
- `GET /shops?country=&city=&category=&type=&q=` → `Shop[]`; city/category/type filtering is server-side as well as client-visible.
- Seed data is not returned from the backend. The UI fallback remains visibly marked sample-only.
- Paid seller placement must set `promotionLabel` to `Featured` or `Sponsored` on promoted placements. This label discloses paid promotion and is not a sales guarantee.

## Shop and listing services

- `GET /shops/:id` → full shop if public access policy allows it.
- `GET /shops/mine` → authenticated seller's shop; seller ownership enforced.
- `POST /shops`: categories, name/story/tagline, country/city, sell type and visual preferences → created shop; **seller** only.
- `PATCH /shops/:id`: partial shop update → updated shop; **owner seller** only.
- Shop onboarding requires the seller's international WhatsApp number (`+` and country calling code). It is public, and buyers can open WhatsApp with a prefilled listing request.
- WhatsApp requests are not FashionHub orders and do not process payment. The seller confirms stock, final price, fulfillment and direct payment in WhatsApp.
- `GET /listings/:id`, `GET /listings/mine`, and `GET /listings?shopId=` → listing resources.
- `POST /listings`, `PATCH /listings/:id`, `DELETE /listings/:id` → create/update/remove listing; **owner seller** only.
- Product fields may include size/colour/finish; services may include service details and enquiry label. Validate category/type consistency server-side.
- `isSeed` is a development UI marker only; production APIs must not mark live records as seed.

## Subscription access and plans (paused)

All purchase screens and subscription access requirements remain off. The plan catalogue route is retained, but submission, renewal, access and payment-review APIs are not implemented or enabled.

## Payment submission and subscription lifecycle (not active)

- `GET /subscriptions/mine` → authenticated account's subscription records, including `status`, `paymentStatus`, plan, country, `transactionReference`, `submittedAt`, `renewalDate`, `expiresAt`, and optional review metadata.
- `POST /subscriptions/submissions` multipart: `planId`, `payerType` (`buyer | seller`), `countryCode`, `transactionReference`, `requestType` (`new | renewal`), optional `receipt` file → new subscription request. The server must create it as `pending_verification`; it must not approve based on form submission or a receipt alone.
- `POST /subscriptions/:id/renew`: authenticated subscription owner only; creates a new pending verification request and returns the new record.
- `POST /subscriptions/:id/cancel`: authenticated subscription owner only; returns server-confirmed `cancelled` state (or a business-rule error). Do not remove/cancel locally before the response.
- Status transitions: `pending_verification → approved | declined`; `approved → expired | cancelled` per backend policy. Expired, declined and cancelled records may request a new renewal that starts pending.
- A transaction reference/receipt is not proof of payment. Verification, state transitions, timestamps, audit trail and any refunds are backend responsibilities.

## Saved items, enquiries, orders and fulfillment

- `GET /account/saved`, `PUT /account/saved/:listingId`, `DELETE /account/saved/:listingId`: authenticated buyer saved items.
- `POST /enquiries`, `GET /account/enquiries`, and `GET /seller/enquiries` persist and scope enquiry records. `GET` and `POST /enquiries/:id/messages` return or append messages only for a conversation participant. The legacy seller reply endpoint appends a message to the same thread.
- `POST /orders`, `GET /account/orders`, `GET /seller/orders`, and order status routes persist order requests. The database function restricts seller status transitions. Payments, inventory reservation, courier booking and proof of delivery are not included.
- `GET /listings/:id/reviews` and `POST /orders/:id/review` show public reviews and permit a buyer to review only their completed order.
- `POST /reports` accepts a listing or reported-user ID, reason and optional details. Admin report queue/review APIs are available under `/admin/reports`.

## Account settings, notifications and deletion

- `GET /account/settings` → authenticated account profile, country/city and notification preferences.
- `PATCH /account/settings`: partial `{ name, countryCode, city?, notificationPreferences }` → validated updated account.
- `GET /account/notifications` and `GET /account/notifications/unread-count` → account-scoped notification feed/count.
- `POST /account/notifications/:id/read`, `POST /account/notifications/read-all` → mark read; only that account's records.
- `DELETE /account`: `{ confirmation: "DELETE" }` → creates a deletion request. It does not erase the auth account or profile yet; review/fulfillment needs an admin queue.
- Notifications are stored in Supabase and generated by enquiry-message/order triggers. They are in-app only; no email/push notifications are configured.

## Admin settings, reports and review

- The configured email `kigozigeofrey09@gmail.com` is checked in both backend authorization and the latest database policies.
- `GET /admin/settings`, `GET /admin/countries`, `POST /admin/countries`, and country currency/instruction updates support country administration.
- `GET /admin/reports/sellers` and `GET /admin/reports/listings` return aggregate counts.
- `GET /admin/subscriptions` → payment review queue; **admin** only.
- `POST /admin/subscriptions/:id/review`: `{ decision: approved | declined, note? }` → authoritative reviewed record with reviewer/time audit fields. The server must refuse review of ineligible states and enforce admin authorization.
- `POST /admin/subscriptions/:id/status`: `{ status, note? }` for administrative expiry/cancellation corrections, audited and constrained by backend transition rules.

Seller-profile reporting and actual listing takedown actions are not implemented yet. Review and report records are available, with a basic admin review queue for safety reports.
