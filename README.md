# NITW Market

**Buy from seniors. Sell to juniors.**

A student-to-student marketplace for NIT Warangal. Students can list items (textbooks, electronics, cycles, hostel items, etc.), browse and search listings, reserve items, and arrange campus pickup — all within the NITW community.

## Tech Stack

- **Frontend:** Next.js 13 (App Router), TypeScript, Tailwind CSS
- **UI Components:** Custom shadcn/ui-style components (Button, Card, Input, etc.)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Deployment:** Vercel (or any Next.js-compatible platform)

## Project Architecture

```
Browser (Next.js frontend)
  ├── Public pages: Home, Browse, Product Detail, Categories
  ├── Auth pages: Login, Signup (NITW email domain restriction)
  ├── Authed pages: Dashboard, Sell, Edit Listing
  └── Admin pages: Admin Dashboard
         │
         ▼
Supabase (Backend)
  ├── Auth: Email/password, NITW domain enforcement
  ├── PostgreSQL: Normalized schema with Row Level Security (RLS)
  ├── Storage: Product images bucket with per-user policies
  └── Edge Functions: Server-side privileged operations
```

### Key Design Principles

1. **Server-side authorization:** RLS policies enforce all data access at the database level. The frontend never controls authorization — it only renders what the database allows.
2. **No service-role keys in the browser:** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed client-side. Privileged operations go through edge functions or RLS.
3. **NITW email domain restriction:** Signup is limited to `@nitw.ac.in` and `@nittwrangal.ac.in` email addresses.
4. **Reservation workflow (not payments yet):** The order system uses a state machine (pending → confirmed/rejected → completed/cancelled) designed so a payment step can be inserted later.
5. **Admin authorization via JWT metadata:** Admin role is stored in `auth.users.raw_app_meta_data` (user-immutable), checked by RLS policies — never trusted from the frontend.

## Folder Structure

```
/
├── app/
│   ├── (auth)/              # Auth route group (login, signup)
│   │   ├── layout.tsx       # Centered auth layout
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/              # Main route group (navbar + footer)
│   │   ├── layout.tsx       # Navbar + footer + AuthProvider
│   │   ├── page.tsx         # Homepage
│   │   ├── browse/          # Search + filter page
│   │   ├── product/[id]/    # Product detail
│   │   ├── category/[slug]/ # Category page
│   │   ├── sell/            # Create listing
│   │   └── dashboard/       # User dashboard
│   │       ├── page.tsx     # My listings
│   │       ├── orders/
│   │       ├── saved/
│   │       └── profile/
│   ├── layout.tsx           # Root layout (fonts, metadata)
│   └── globals.css          # Design system tokens
├── components/
│   ├── ui/                  # Base UI primitives (button, card, etc.)
│   ├── navbar.tsx
│   ├── footer.tsx
│   ├── product-card.tsx
│   ├── search-bar.tsx
│   ├── category-nav.tsx
│   ├── empty-state.tsx
│   └── loading-skeleton.tsx
├── hooks/
│   └── use-auth.tsx         # Auth context provider
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser Supabase client
│   │   ├── server.ts        # Server Supabase client (cookies)
│   │   └── middleware.ts    # Session refresh + route protection
│   ├── utils.ts             # cn(), formatPrice(), timeAgo()
│   ├── constants.ts         # Categories, branches, years, etc.
│   └── types/               # (future: generated DB types)
├── supabase/
│   ├── config.toml          # Supabase project config
│   └── functions/           # Edge functions (added in later phases)
├── middleware.ts            # Next.js middleware (session refresh)
└── .env                     # Environment variables
```

## Environment Variables

The following are pre-populated and required. Do NOT commit `.env` to git.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Anon key for browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Edge functions, admin ops |
| `SUPABASE_DB_URL` | Server only | Direct DB access |

No payment-related env vars are needed yet. When Razorpay is added (Phase 8), `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` will be configured as edge function secrets.

## Local Development

This project is designed to be developed from any browser-based IDE. No local-only services are required.

### Prerequisites

- Node.js 18+ (or use an online IDE like StackBlitz, CodeSandbox, or Google Antigravity)
- A Supabase project (already provisioned — see `.env`)

### Steps

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure `.env` contains the Supabase variables (already configured)
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000`

### Building

```bash
npm run build
```

## Supabase Setup

### Database Migrations

Seven migrations have been applied via the Supabase MCP tools:

| Migration | Description |
|---|---|
| `001_profiles_and_categories` | Enum types, profiles table, categories table, admin helper functions, auto-create profile trigger, seed 9 categories |
| `002_products_and_images` | Products table with price/condition/status, product_images child table, per-owner RLS |
| `003_orders_favorites_reviews` | Orders (reservation system), favorites (bookmarks), reviews (gated to completed orders) |
| `004_notifications_and_reports` | Per-user notifications, moderation reports with admin-only resolution |
| `005_storage_bucket` | Private `product-images` bucket with 5MB limit, per-user folder policies |
| `006_fix_security_warnings` | Fixed mutable search_path on trigger functions, revoked PUBLIC EXECUTE on SECURITY DEFINER functions |
| `007_revoke_trigger_function_execute` | Revoked anon/authenticated EXECUTE on trigger-only functions |

To see applied migrations, check the Supabase dashboard → SQL Editor → Migrations.

### Database Schema

```
profiles          ← auth.users (1:1, auto-created on signup)
  id, name, email, roll_number, branch, year, hostel_block,
  avatar_url, role, is_suspended, created_at, updated_at

categories        ← seeded (9 rows: Books, Electronics, ...)
  id, name, slug, icon, sort_order

products          ← profiles (seller), categories
  id, seller_id, category_id, title, description, price,
  condition, status, image_url, view_count, created_at, updated_at

product_images    ← products (1:N)
  id, product_id, image_url, sort_order

orders            ← products, profiles (buyer + seller)
  id, product_id, buyer_id, seller_id, status, quantity,
  message, meeting_location, completed_at, created_at, updated_at

favorites         ← profiles, products (user bookmarks)
  id, user_id, product_id (UNIQUE user+product)

reviews           ← orders, profiles (reviewer + reviewee), products
  id, order_id (UNIQUE), reviewer_id, reviewee_id, product_id,
  rating (1-5), comment

notifications     ← profiles (per-user alerts)
  id, user_id, type, title, body, link, is_read

reports           ← profiles (reporter), profiles (resolver)
  id, reporter_id, target_type, target_id, reason, status,
  admin_notes, resolved_by, resolved_at
```

### Row Level Security (RLS)

Every table has RLS enabled. Key policies:

- **profiles:** Users read/update their own profile. Admins read all. `role` and `is_suspended` columns are protected via column-level grants — only admin SECURITY DEFINER functions can change them.
- **categories:** Public read (anon + authenticated). No client writes.
- **products:** Public can browse active/reserved/sold listings. Sellers see their own removed listings. Only the seller or admin can create/update/delete. `seller_id` defaults to `auth.uid()`.
- **product_images:** Public can view images of visible products. Only the product's seller or admin can add/modify/delete images.
- **orders:** Only buyer, seller, or admin can view/update/delete. Buyer creates orders; `seller_id` is auto-set from the product via a trigger.
- **favorites:** Owner-only access (SELECT/INSERT/DELETE). Unique constraint prevents duplicate bookmarks.
- **reviews:** Public read. INSERT gated server-side: only the buyer of a **completed** order can leave a review for that order. One review per order (UNIQUE constraint).
- **notifications:** Owner-only access.
- **reports:** Reporter sees their own reports; admins see all. Only admins can update status/notes. Reporters cannot delete reports once submitted.

### Admin Privilege Protection

Admin authorization uses a `role` column in `profiles` (enum: `user`, `admin`).

- The `role` and `is_suspended` columns are **not writable by clients** — `REVOKE UPDATE` removes them from the authenticated role's column grants.
- Changes go through SECURITY DEFINER functions (`set_user_role`, `set_user_suspended`) that verify the caller is an admin before modifying the target user.
- The `is_admin()` helper function checks `profiles.role = 'admin'` for the current session and is used by RLS policies across all tables.
- An unauthenticated user cannot call any SECURITY DEFINER function.

### Storage

Product images are stored in a private Supabase Storage bucket (`product-images`). Policies ensure:
- Anyone can view product images (anon read)
- Only authenticated users can upload, into their own folder: `product-images/<uid>/<filename>`
- Only the folder owner can update/delete their images
- File size limit: 5MB. Allowed types: JPEG, PNG, WebP, GIF

## Deployment

### Deploy to Vercel

1. Push the repository to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Next.js and builds the project

The project is configured for zero-config deployment. No Docker or local services needed.

## Development Phases

- [x] **Phase 1:** Project foundation (Next.js, Supabase connection, design system, navbar, homepage, auth pages)
- [x] **Phase 2:** Database schema, migrations, RLS policies, seed categories
- [ ] **Phase 3:** Marketplace (listings, image uploads, product page, search, filtering)
- [ ] **Phase 4:** User functionality (profile, seller dashboard, buyer dashboard, favorites)
- [ ] **Phase 5:** Reservations (orders, workflow, notifications)
- [ ] **Phase 6:** Trust and safety (reviews, reports, admin dashboard, moderation)
- [ ] **Phase 7:** Testing and security audit
- [ ] **Phase 8:** Payment architecture (Razorpay preparation)

## Continuing Development from Another IDE

This project is designed to be picked up from any browser-based IDE:

1. Clone from GitHub — the repo is the single source of truth
2. Run `npm install` to restore dependencies
3. Ensure `.env` has the Supabase variables (get them from the Supabase dashboard → Settings → API)
4. The database schema and RLS policies live in Supabase, applied via 7 tracked migrations — managed via Supabase MCP tools or the Supabase dashboard
5. Start coding

### Notes for Continuation

- All database migrations are applied directly to the Supabase project. There are no local migration files that need to be run.
- Edge functions are deployed via Supabase MCP tools. Source files live in `supabase/functions/`.
- The Supabase config is in `supabase/config.toml`.
- TypeScript types for the database can be generated from the Supabase dashboard (Settings → API → Type Generation) or via `npx supabase gen types`.
