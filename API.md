# FashionHub API contract

The front end uses `src/services/api.ts`. Set `VITE_API_BASE_URL` to the backend API origin (including `/api`) or leave it unset to use same-origin `/api` routes. Requests include cookies (`credentials: include`) and expect JSON unless a receipt is submitted as multipart form data.

Marketplace browsing, authentication, seller shop/listing management, account settings/saved items, enquiries, order requests/status, in-app notifications, and basic admin country/report tools have backend routes. Run the matching Supabase migrations before using these live APIs. Seed catalog entries are browse-only and include `isSeed: true`.

## Authentication and session

- `GET /auth/session` returns `{ user: { id, name, email, role, countryCode? } }` for an authenticated session; unauthenticated requests return `401`.
- `POST /auth/sign-in` accepts `{ email, password, role }`; verifies the Supabase account and starts a secure HTTP-only cookie session.
- `POST /auth/sign-up-password` accepts `{ name, email, password, role, countryCode }`; Supabase emails an address-confirmation link.
- `POST /auth/sign-in-link` and `/auth/sign-up` retain the email-link flow for clients that still use it.
- `POST /auth/password/forgot` accepts `{ email }` and always return a non-enumerating status message.
- `POST /auth/password/reset/confirm` accepts `{ password }` after the recovery callback establishes the secure recovery session.
- `GET /auth/me` returns the authenticated user and role.

No credentials or session are written to local storage. Prefer secure, HTTP-only cookies. Enforce CSRF protections and rate limits on the backend.

## Countries and marketplace

- `GET /countries` returns `Country[]`: `{ code, name, currency, cities, paymentInstructions? }`.
- `GET /listings?country=&city=&category=&type=&q=&sort=` returns `Listing[]`; each listing includes country/currency metadata and seller/shop identifiers.
- `GET /listings/:id` returns a listing.
- `GET /shops?country=&city=&category=&type=&q=` returns filtered shops.
- `GET /shops/:id` and `GET /shops/:id/listings` return a shop and its catalog.

Currency conversion is not done by the client. Return the price and currency code together. `paymentInstructions` must be configured per country; the Uganda reference `0773927881` is specific to Uganda.

## Seller

- `POST /shops` creates a shop from validated onboarding data. Requires a seller session, validates country/currency/city, and prevents duplicate shops.
- `GET /shops/mine` returns the authenticated seller's shop or `null` when they have not created one yet.
- `PATCH /shops/:id` updates the seller's shop; the backend verifies the seller role and ownership.
- `GET /listings/mine` returns the seller's listings.
- `POST /listings`, `PATCH /listings/:id`, `DELETE /listings/:id` create, update and delete listings; authorize shop ownership.
- Listing image uploads are saved on the local PC disk. Back up the image directory; it is not durable hosted storage.

## Buyer account, enquiries and orders

- `GET /account/settings` returns the signed-in user's profile and account preferences. `PATCH /account/settings` accepts profile name, enabled country, city and notification preferences.

- `GET /account/saved`, `PUT /account/saved/:listingId`, `DELETE /account/saved/:listingId` manage the signed-in user's saved listings.
- `POST /enquiries`, `GET /account/enquiries`, and `GET /seller/enquiries` manage enquiry threads. `GET` and `POST /enquiries/:id/messages` provide private two-way buyer/seller messages. The older `POST /seller/enquiries/:id/reply` endpoint remains compatible and appends to that thread.
- `POST /orders`, `GET /account/orders`, `GET /seller/orders`, `PATCH /orders/:id/status`, and the seller pickup/delivery endpoints support order requests and guarded status changes. An order is a request, not a payment or confirmed delivery.
- `GET /listings/:id/reviews` returns public reviews; `POST /orders/:id/review` accepts a rating and optional text only after the buyer's order is completed.
- `POST /reports` submits a listing or account safety report. `GET /admin/reports` and `PATCH /admin/reports/:id` provide a basic admin review queue.
- `DELETE /account` stores an account deletion request for follow-up; it does not automatically erase Supabase Auth or profile data.

## Notifications

- `GET /account/notifications` and `GET /account/notifications/unread-count` return account-scoped in-app notifications.
- `POST /account/notifications/:id/read` and `POST /account/notifications/read-all` mark notifications read.
- Database triggers create notifications for enquiry messages and order requests/status updates. Email or push delivery is not configured.

## Subscriptions (paused)

- `GET /subscriptions/plans` returns configured plans with payer type (`seller`, `buyer`, or `both`), price/currency and renewal period. Until configured, the UI displays “Awaiting confirmation”.
- `GET /subscriptions/mine` returns the current account's subscription records.
- `POST /subscriptions/submissions` accepts multipart fields `payerType`, `countryCode`, `planId`, `transactionReference`, and optional `receipt`. New records must be created as `pending_verification`; never mark one paid or approved on submission.
- `POST /subscriptions/:id/renew` creates a new pending verification request; it must not bypass reference/receipt requirements if required by business policy.
- `GET /admin/subscriptions` returns reviewable payment submissions to an admin.
- `POST /admin/subscriptions/:id/review` accepts `{ decision: "approved" | "declined", note? }`; require authenticated admin authorization and audit the reviewer and timestamp.

A transaction reference or receipt is not proof of payment. The back end must verify it and enforce state transitions. Never collect/store mobile-money PINs, passwords, or OTPs.

## Admin settings

- `GET /admin/settings` returns `{ plans, countries }` for an authenticated admin.
- `PUT /admin/settings` updates plan configuration.
- `POST /admin/countries` adds a country and currency.
- `PUT /admin/countries/:code/payment-instructions` updates instructions for that country.

The configured administrator `kigozigeofrey09@gmail.com` is authorized server-side and by the matching SQL policies. Admin APIs support country management and aggregate seller/listing reports. Subscription plan editing and payment review remain paused and are not active APIs. Account deletion requests are not yet shown in an admin queue.
