# Changelog

All notable changes to NITW Market are documented here.
This file is maintained alongside every code change so the project state is traceable when pulled into another environment (e.g. Google Antigravity).

## [Unreleased]

### 2026-10-21 — Repository initialized for GitHub

- Initialized a git repository at the project root and staged the full codebase.
- Added `CHANGELOG.md` to record every subsequent change to the project.
- Confirmed `.gitignore` excludes `node_modules`, `.next/`, `.env`, and build artifacts so secrets and dependencies are never committed.
- Verified the project builds via `npm run build`. Static-generation warnings on dashboard/browse routes are expected — those pages rely on Supabase env vars that are only present at runtime, not at static export time. The build itself completes.

## Earlier work (pre-git, carried over from README)

The following was built before git tracking was initialized. It is captured here so the history is not lost when the repo is cloned elsewhere.

### Phase 1 — Project foundation
- Scaffolded Next.js 13 (App Router) with TypeScript and Tailwind CSS.
- Wired Supabase clients: browser client (`lib/supabase/client.ts`), server client with cookie sessions (`lib/supabase/server.ts`), and session-refresh middleware (`lib/supabase/middleware.ts`, `middleware.ts`).
- Built the design system in `app/globals.css` and custom shadcn/ui-style primitives under `components/ui/` (button, card, input, label, select, textarea, dialog, badge, avatar, skeleton, spinner).
- Implemented the navbar, footer, search bar, category nav, product card, product image, empty state, and loading skeleton components.
- Built the homepage, browse page, category page, and product detail page.
- Built auth pages (login, signup) with NITW email-domain restriction and a centered auth layout.

### Phase 2 — Database schema, migrations, RLS
- Applied 8 Supabase migrations via MCP tools:
  1. `001_profiles_and_categories` — enum types, profiles, categories, admin helpers, auto-profile trigger, 9 seeded categories.
  2. `002_products_and_images` — products + product_images with per-owner RLS.
  3. `003_orders_favorites_reviews` — orders (reservation state machine), favorites, reviews.
  4. `004_notifications_and_reports` — per-user notifications, moderation reports.
  5. `005_storage_bucket` — private `product-images` bucket, 5MB limit, per-user folders.
  6. `006_fix_security_warnings` — fixed mutable `search_path`, revoked PUBLIC EXECUTE.
  7. `007_revoke_trigger_function_execute` — revoked anon/authenticated EXECUTE on trigger functions.
  8. `008_product_seller_snapshot` — seller snapshot on products.
- Enabled Row Level Security on every table with per-verb policies (SELECT/INSERT/UPDATE/DELETE).
- Protected `role` and `is_suspended` columns via `REVOKE UPDATE`; admin mutations go through SECURITY DEFINER functions only.

### Phase 3 — Marketplace
- Built the sell page (create listing) and edit-listing page with image uploads to the private storage bucket.
- Product page renders details, images, and seller info with view-count tracking.
- Browse page supports search and category filtering.

### Phase 4 (partial) — User functionality
- Dashboard with My Listings, Orders, Saved, and Profile sub-pages.
- Auth context provider (`hooks/use-auth.tsx`) exposing the session across the app.

### Not yet started
- Phase 5: Reservation workflow + notifications UI.
- Phase 6: Reviews, reports, admin dashboard, moderation.
- Phase 7: Testing and security audit.
- Phase 8: Razorpay payment architecture.

---

### How this file is updated
Every change made to the project (feature, fix, refactor, config) gets a dated entry under `[Unreleased]` describing what changed and why. When a milestone is reached, entries are promoted to a versioned section. Keep this file in sync with every commit so anyone pulling the repo into another IDE knows the current state without reading every commit message.
