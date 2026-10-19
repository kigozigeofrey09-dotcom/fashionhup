# FashionHub

FashionHub is a React + TypeScript fashion marketplace with a Vite front end, an Express backend, and Supabase Auth/Postgres. The normal app uses live API data only. Bundled catalog examples stay in the source as an optional development preview and are off by default.

## Run in VS Code on Windows

Open `FashionHub/fashionhub-frontend` in VS Code. Install dependencies once with `npm.cmd install`.

From one VS Code PowerShell terminal in that folder, run both services together:

1. Run `npm.cmd run dev:all` and keep the terminal open. If either the front end or backend exits unexpectedly, the launcher retries it every two seconds. Press Ctrl+C to stop both services.
2. Open the local address printed by Vite, usually `http://127.0.0.1:5173`.

The separate commands `npm.cmd run backend` and `npm.cmd run dev` are also available when you want two terminals.

The backend listens at `http://127.0.0.1:4000`. A local development server only stays available while your PC is on, connected, and the launcher terminal remains open. For access while your PC is off, deploy the backend and database services to an online host.

## Supabase setup

Keep the existing root `.env` private. It must contain `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; local defaults use the two localhost origins in `.env.example` and `/api` for the Vite proxy.

Apply `supabase/migrations/202610100001_marketplace_core.sql`, `202610100002_live_marketplace_search.sql`, `202610110003_account_settings.sql`, `202610110004_fashionhub_images.sql`, `202610110005_listing_legacy_compat.sql`, `202610110006_marketplace_workflows.sql`, then `202610110007_buyer_seller_messages.sql` in that order in the Supabase SQL Editor. If you applied earlier versions, re-run the updated migrations 001 and 005, then run 006 and 007. Migration 005 maps legacy listing fields; migration 006 adds enquiries, account notifications, deletion requests, guarded order status updates, and administrator database policies; migration 007 adds private two-way buyer/seller conversations and migrates existing enquiry messages. The policies and backend use the existing `shops.owner_id` column. The administrator email `kigozigeofrey09@gmail.com` is allowlisted in the backend and admin-only database policies. Image files are saved to `backend/storage/images` on this PC by default, up to 10 GB total and 10 MB per file. Add `FASHIONHUB_STORAGE_DIR` to `.env` to choose a different disk folder. Keep the backend running and back up this folder; local image URLs are available only while this PC and backend are online. In Supabase Auth URL Configuration, allow `http://127.0.0.1:4000/api/auth/callback` as a redirect URL, and enable email authentication. New accounts need to confirm their email before password sign-in.

When the backend is running and connected, sign up or sign in at `/auth/sign-up` or `/auth/sign-in`. Create a seller account, set up a shop, then publish listings from the seller studio. The public marketplace displays listings and shops returned by the live API; it does not fill in sample products when the API is unavailable.

## Temporarily paused features

Subscription pages, purchase entry points, and subscription access checks are paused without deleting their code. To restore them later, set `VITE_SUBSCRIPTIONS_ENABLED=true` in `.env` and restart Vite.

Development catalog data is also off by default. Set `VITE_DEMO_DATA_ENABLED=true` only when you want to preview bundled examples. Restart Vite after changing either feature flag.

## Routes

- Marketplace: `/`
- Listing and shop details: `/listings/:id`, `/shops/:id`
- Sign in, sign up, and password recovery: `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/reset-password`
- Seller onboarding and studio: `/seller/setup`, `/seller/dashboard`
- Account, enquiries and order status: `/account`, `/enquiries`
- Paused subscription page: `/subscriptions`
- Admin, support and policies: `/admin`, `/support`, `/policies`

Marketplace, accounts, seller listings, private buyer/seller message threads, notifications, admin country tools and order requests use the backend routes in `backend/src/routes/`. WhatsApp contact remains an optional direct seller-to-buyer request and does not process payments. Subscription purchasing remains paused. Local disk uploads are for development; use durable hosted object storage before public production launch.
