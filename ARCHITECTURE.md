# BIDPal System Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│              Next.js 16 + React 19 + CSS Modules                    │
├─────────────────────────────────────────────────────────────────────┤
│                        APPLICATION LAYER                            │
│              Node.js + Express.js 5 + Socket.IO 4                   │
├─────────────────────────────────────────────────────────────────────┤
│                           DATA LAYER                                │
│     Relational DB + In-Memory Cache + Background Job Queue          │
├─────────────────────────────────────────────────────────────────────┤
│                       EXTERNAL SERVICES                             │
│         Streaming · Payments · Logistics · Notifications            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Presentation Layer
**Technology: Next.js 16 (App Router) + React 19 + CSS Modules**
**Location: `/src/`**

### Pages (`/src/app/`)

| Page | Path | Description |
|------|------|-------------|
| Home | `/` | Hero banner, category navigation, auction listings |
| Sign In | `/(auth)/signin` | Email/password + Google OAuth login |
| Sign Up | `/(auth)/signup` | User registration |
| Forgot Password | `/(auth)/forgot-password` | Password recovery |
| Live Auction | `/live/[id]` | Live video stream + real-time bidding |
| Messages | `/messages` | Real-time buyer-seller messaging |
| Orders | `/orders` | Order history and tracking |
| Shipment Tracking | `/orders/[id]/tracking` | Live delivery status from logistics provider *(planned)* |
| Cart | `/cart` | Shopping cart |
| Checkout | `/checkout` | Payment and shipping selection |
| Profile | `/profile` | User profile management |
| Search | `/search` | Product/auction search and filtering |
| Settings | `/settings` | User preferences |
| Seller Setup | `/seller/setup` | 4-step seller onboarding (incl. ID verification) |
| Seller Dashboard | `/seller` | Seller home with metrics |
| Seller Auctions | `/seller/auctions` | Auction management |
| Add Product | `/seller/add-product` | Product listing creation |
| Inventory | `/seller/inventory` | Product inventory management |
| Analytics | `/seller/analytics` | Sales analytics and charts |
| Seller Settings | `/seller/settings` | Store configuration |
| **Admin Panel** *(planned)* | `/admin` | Platform-wide management |
| **Admin Users** *(planned)* | `/admin/users` | User/seller management |
| **Admin Auctions** *(planned)* | `/admin/auctions` | Auction moderation |
| **Admin Violations** *(planned)* | `/admin/violations` | Strike and appeal management |
| **Admin Analytics** *(planned)* | `/admin/analytics` | Platform-wide reporting |

### Components (`/src/components/`)

| Component Group | Location | Contains |
|----------------|----------|----------|
| Cards | `/components/card/` | AuctionCard, ProductCard |
| Home | `/components/home/` | HeroBanner, CategoryNav |
| Layout | `/components/layout/` | Header, navigation |
| Map | `/components/map/` | Leaflet map display |
| Pricing | `/components/pricing/` | PriceRecommendation UI |
| Seller | `/components/seller/` | Sidebar, seller dashboard widgets |
| UI | `/components/ui/` | Button, Input, shared UI primitives |

### State & Hooks (`/src/context/`, `/src/hooks/`)

| Item | Purpose |
|------|---------|
| `AuthContext` | Global authentication state (user session, JWT) |
| `CartContext` | Shopping cart state across pages |
| Custom hooks | Data fetching, real-time updates, geolocation |

---

## 2. Application Layer
**Technology: Node.js + Express.js 5 + Socket.IO 4**
**Location: `/backend/`**

### Services at a Glance

```
APPLICATION LAYER
├── REST API Server                → Express.js
├── WebSocket / Event Server       → Socket.IO
├── Authentication Service         → JWT + bcrypt + Google OAuth
├── File Upload Service            → Multer
├── Price Intelligence Service     → Google Gemini AI + Random Forest ML
├── Stream Token Service           → Agora RTC / RTM
├── Rule-Based Fraud Detection     → Strike Engine + Violation Service + Cancellation Service
├── Background Job Processors      → Payment Window Checker (cron) / BullMQ Workers (planned)
├── Notification Dispatcher        → Transactional Email + SMS (planned)
├── Webhook Handler                → Receives updates from Veriff, Logistics (planned)
├── ID Verification Service        → Veriff (planned)
└── Admin & Moderation Service     → Custom (planned)
```

### API Server (`/backend/server.js`)
- REST API on port `5000`
- Socket.IO for real-time events (bids, viewer counts, comments, notifications)
- CORS configured for frontend origin
- Background job: payment window checker (`/backend/jobs/`)

### Routes → Controllers (`/backend/routes/` → `/backend/controllers/`)

| Domain | Route File | Key Endpoints |
|--------|-----------|---------------|
| Auth | `auth.routes.js` | POST /login, /register, /google-login |
| Users | `user.routes.js` | GET/PUT /profile, /avatar, /violations, /appeals |
| Sellers | `seller.routes.js` | POST /create, PUT /update, /logo, /banner |
| Auctions | `auction.routes.js` | CRUD, /start, /end, /place-bid, /winner, /stats, /comments |
| Products | `product.routes.js` | CRUD, /search, /status, /restore |
| Orders | `order.routes.js` | POST /create, GET /user, PUT /status, /payment |
| Cart | `cart.routes.js` | POST /add, PUT /update, DELETE /remove, GET /user |
| Messages | `message.routes.js` | POST /send, GET /conversations, /messages, /unread |
| Addresses | `address.routes.js` | CRUD, /default, /regions, /provinces, /cities, /barangays |
| Dashboard | `dashboard.routes.js` | GET /summary, /bids, /shares, /views, /likes |
| Follows | `follow.routes.js` | POST /follow, DELETE /unfollow, GET /followers, /following |
| Notifications | `notification.routes.js` | GET /all, PUT /read, POST /create, GET /unread-count |
| Agora Tokens | `agora.routes.js` | POST /rtc-token, /rtm-token |
| Pricing | `price.routes.js` | POST /recommend (AI + ML) |
| Violations | `violation.routes.js` | GET /check-eligibility, POST /report, /appeal, GET /moderation |
| **ID Verification** *(planned)* | `verification.routes.js` | POST /start-session, POST /webhook, GET /status |
| **Shipping** *(planned)* | `shipping.routes.js` | POST /book, GET /track, POST /webhook |
| **Admin** *(planned)* | `admin.routes.js` | User management, auction oversight, platform analytics |

### Services (`/backend/services/`)

| Service | File | Responsibility |
|---------|------|----------------|
| Price Recommendation | `priceRecommendationService.js` | ML + Gemini AI price analysis |
| Random Forest Model | `modelTrainingService.js` | Mercari dataset training (1.4M records) |
| Agora Token Generation | (in controller) | RTC + RTM token generation |
| **Strike Engine** | `strikeEngine.js` | Three-strike escalation — issues warnings, restrictions, suspensions |
| **Violation Service** | `violationService.js` | Detects and records bogus bidding and joy reserving behavior |
| **Cancellation Service** | `cancellationService.js` | Enforces cancellation limits (4+ per week triggers a strike) |
| **Payment Window Checker** | `jobs/paymentWindowChecker.js` | Hourly cron — flags expired 24h payment windows, triggers strikes |
| **Veriff Verification** *(planned)* | `veriffService.js` | Session creation, webhook handling, ID status |
| **Notification Dispatcher** *(planned)* | `notificationService.js` | Sends transactional emails and SMS alerts |
| **Logistics Service** *(planned)* | `logisticsService.js` | Books shipments, tracks delivery status via courier API |
| **Admin Service** *(planned)* | `adminService.js` | Aggregate stats, user control, content moderation |

### Middleware (`/backend/middleware/`)

| Middleware | Purpose |
|-----------|---------|
| `authMiddleware.js` | JWT validation, user identity on protected routes |
| **Admin Middleware** *(planned)* | Role check — restricts routes to admin users only |

### Rule-Based Fraud Detection Engine (Implemented)

**How it works — bid placement flow:**

```
Buyer clicks "Place Bid"
        ↓
REST API receives request
        ↓
violationService.js checks bidding eligibility   ← BEFORE saving bid
        ↓
┌── PASS → bid accepted, saved to DB
└── FAIL → bid rejected, reason shown to buyer
```

**Anti-Bogus Bidding & Joy Reserving Rules:**

| Behavior | Threshold | Detection Method | Consequence |
|----------|-----------|-----------------|-------------|
| Missed payment | 24h after auction end | Hourly cron job (`paymentWindowChecker.js`) | Strike 1 — Warning |
| Repeated missed payment | 2nd missed payment | Cron job + violation history check | Strike 2 — Pre-authorization required before bidding |
| Repeated missed payment | 3rd missed payment | Cron job + violation history check | Strike 3 — Account suspended, moderation case created |
| Excessive cancellations | 4+ cancellations per week | Real-time check on each cancellation (`cancellationService.js`) | Strike triggered |
| Seller reports bogus buyer | Manual report | Seller submits report via violations route | Moderation review initiated |
| 3 strikes total | Any combination | `strikeEngine.js` evaluates cumulative strikes | Permanent ban + SHA-256 identity hash blocks re-registration |

**Strike Escalation (strikeEngine.js):**

```
Strike 1 → Warning notification sent to buyer
Strike 2 → Pre-authorization required before placing any new bid
Strike 3 → Account suspended + moderation case opened
3 Strikes → Permanent ban + SHA-256 hash of identity stored
             (blocks re-registration using same identity)
```

**Frontend Enforcement:**
- `src/app/orders/page.js` — visual warnings when approaching payment deadline
- `src/components/CancellationModal.js` — warns user when nearing cancellation limit, blocks action when restricted

### Socket.IO Events (real-time)

| Event | Direction | Triggered By |
|-------|-----------|-------------|
| `new_bid` | Server → Clients | New bid placed on auction |
| `auction_update` | Server → Clients | Auction status change |
| `viewer_count` | Server → Clients | Viewer joins/leaves live stream |
| `live_comment` | Server → Clients | New comment during live auction |
| `notification` | Server → User | Bid win, order update, message received |

---

## 3. Data Layer

```
DATA LAYER
├── Relational Database      → Supabase (PostgreSQL)   ← permanent storage
├── In-Memory Cache          → Redis                   ← fast temporary data (planned)
└── Background Job Queue     → BullMQ                  ← scheduled tasks (planned)
```

| Component | Technology | Role | Persistence |
|-----------|-----------|------|-------------|
| **Relational Database** | Supabase (PostgreSQL) | All permanent data — users, auctions, orders, bids | Disk — never lost |
| **In-Memory Cache** | Redis | Active auction state, session tokens, leaderboard | RAM — fast, temporary |
| **Background Job Queue** | BullMQ (uses Redis) | Payment deadline checks, email/SMS dispatch, retry logic | RAM + Redis — survives restarts |

### What goes in each:

**Relational Database (Supabase / PostgreSQL)**
- Source of truth for all business data
- Queried by all backend controllers

**In-Memory Cache (Redis)** *(planned)*
- Current auction price and bid count (so every bid doesn't hit PostgreSQL)
- Active user sessions
- Auction leaderboard during live events

**Background Job Queue (BullMQ)** *(planned)*
- "Check payment in 48h for Order #123" — queued when auction ends
- Email/SMS dispatch jobs with automatic retry on failure
- Replaces the current simple interval-based `jobs/` checker

---

### Database Tables (Supabase / PostgreSQL)

#### User & Identity

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `User` | id, email, password_hash, role, avatar, status | Roles: buyer, seller, admin |
| `Seller` | id, user_id, store_name, store_logo, store_banner, is_verified | Linked to User |
| `Addresses` | id, user_id, full_address, region, province, city, barangay, is_default | PH address hierarchy |

#### Marketplace

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `Products` | id, seller_id, title, description, price, category, status, brand | status: active, inactive, draft |
| `Product_Images` | id, product_id, image_url, order | Multiple images per product |
| `Auctions` | id, product_id, seller_id, start_price, current_price, status, start_time, end_time | status: scheduled, active, ended, completed |
| `Bids` | id, auction_id, bidder_id, amount, placed_at | Full bid history |
| `Orders` | id, buyer_id, auction_id, total_amount, status, payment_method, shipping_option | status: pending, paid, shipped, completed |
| `Shipments` | id, order_id, courier, waybill_number, status, estimated_delivery *(planned)* | Delivery tracking records |
| `Cart` | id, user_id, product_id, quantity | Standard cart items |

#### Social & Communication

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `Messages` | id, sender_id, receiver_id, conversation_id, content, read_at | Direct messaging |
| `Follows` | id, follower_id, seller_id, followed_at | User → Seller follows |
| `Notifications` | id, user_id, type, content, is_read, created_at | In-app notifications |
| `Live_Comments` | id, auction_id, user_id, comment, created_at | Real-time auction chat |

#### Moderation & Fraud Detection

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `Violation_Records` | id, user_id, type, strike_count, status | 3-strike system — tracks bogus bidding and joy reserving |
| `Appeals` | id, violation_id, user_id, reason, status, resolved_at | User appeal requests against strikes |
| `Moderation_Cases` | id, reporter_id, target_id, type, status | Seller-reported bogus buyers, flagged accounts |
| `Cancellation_Logs` | id, user_id, order_id, reason, cancelled_at | Tracks weekly cancellation count per user |
| `Identity_Hashes` | id, sha256_hash, banned_at | SHA-256 hashes of permanently banned identities — blocks re-registration |

#### Verification *(planned)*

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `ID_Verifications` | id, user_id, veriff_session_id, status, verified_at, document_type | Veriff verification records |

#### Admin *(planned)*

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `Admin_Users` | id, user_id, permissions, created_at | Admin account registry |
| `Audit_Logs` | id, admin_id, action, target_type, target_id, timestamp | Admin action logging |

### File / Object Storage (Supabase Storage)

| Bucket | Contents |
|--------|---------|
| `avatars` | User profile pictures |
| `store-assets` | Seller logos and banners |
| `product-images` | Product listing photos |

### Static / Local Data

| File | Location | Contents |
|------|----------|---------|
| PH Locations | `/backend/data/` | Region, Province, City, Barangay JSON |
| Mercari Dataset | `/backend/data/` | 1.4M product records for ML price model |

---

## 4. External Services

### Currently Integrated

| Service | Plain Label | Purpose | Used In |
|---------|------------|---------|---------|
| **Supabase** | Database-as-a-Service | PostgreSQL database + file storage | All backend controllers |
| **Agora RTC** | Live Streaming | Live video streaming for auctions | `/live/[id]` page |
| **Agora RTM** | Real-time Messaging | In-auction chat and messaging | `/live/[id]` page |
| **Google Gemini AI** | AI Price Intelligence | Natural language price recommendations | Price recommendation service |
| **Google OAuth 2.0** | Social Authentication | Sign in with Google | Auth controller |
| **Google Maps API** | Mapping Service | Store location display, address map view | Map component |

### Planned / To Be Integrated

| Service | Plain Label | Purpose | Integration Point |
|---------|------------|---------|-----------------|
| **Veriff** | ID Verification Service | Government ID verification for seller onboarding | `/seller/setup` step 4 → `veriffService.js` |
| **PayMongo / Stripe** | Payment Processing | Card and e-wallet payment processing | Checkout page → order controller |
| **J&T / Ninja Van / LBC** | Shipping & Logistics | Shipment booking and delivery tracking | `logisticsService.js` → shipping routes |
| **SendGrid / Resend** | Transactional Email | Automated emails for bids, orders, violations, OTP | `notificationService.js` |
| **Semaphore / Twilio** | SMS Notifications | Time-sensitive alerts — outbid, payment deadline, OTP | `notificationService.js` |

### What Transactional Email Sends

| Trigger | Email Content |
|---------|--------------|
| User registers | Welcome + email verification link |
| Forgot password | Password reset link |
| Auction won | "You won! Proceed to payment" |
| Order shipped | "Your item is on the way" + tracking number |
| Payment deadline (24h) | Reminder to pay or get a strike |
| Strike issued | Violation notice with appeal instructions |
| Seller verified | "Your store is now active" |

### What SMS Notifications Send

| Trigger | SMS Content |
|---------|------------|
| Outbid during auction | "You've been outbid! Bid now" |
| Auction ending soon | "Auction ends in 5 minutes" |
| Payment deadline approaching | "Pay now to avoid a strike" |
| OTP verification | One-time PIN for seller signup |
| Order picked up by courier | "Your order has been picked up by J&T" |

---

## 5. Rule-Based Fraud Detection System (Implemented)

### Purpose
Prevents two specific fraud behaviors in BIDPal:
- **Bogus Bidding** — fake or malicious bids intended to disrupt auctions
- **Joy Reserving** — winning auctions with no intent to pay

### Component Map

```
Tier 1: Presentation
  ├── orders/page.js              ← payment deadline warnings
  └── CancellationModal.js        ← cancellation limit warnings + blocks

Tier 2: Application
  ├── violationService.js         ← detects violations, checks bid eligibility
  ├── strikeEngine.js             ← escalates strikes (warn → restrict → ban)
  ├── cancellationService.js      ← enforces weekly cancellation limits
  └── jobs/paymentWindowChecker.js ← hourly cron, auto-flags expired payments

Tier 3: Data
  ├── Violation_Records           ← strike history per user
  ├── Moderation_Cases            ← seller-reported bogus buyers
  ├── Cancellation_Logs           ← weekly cancellation tracking
  └── Identity_Hashes             ← SHA-256 hashes of permanently banned users
```

### Enforcement Flow

```
[Automated — every hour]
paymentWindowChecker.js
  └── finds orders unpaid after 24h
        └── violationService.js records violation
              └── strikeEngine.js escalates:
                    Strike 1 → Warning
                    Strike 2 → Pre-authorization required before bidding
                    Strike 3 → Account suspended + moderation case opened
                    3 total  → Permanent ban + SHA-256 hash stored

[Real-time — on each cancellation]
cancellationService.js
  └── counts cancellations this week
        └── 4+ → strikeEngine.js triggered

[Manual — seller reports]
violation.routes.js → violationService.js
  └── moderation case created → admin reviews
```

### No AI Needed (Phase 1)
The rule-based engine is sufficient for current scale. Rules are:
- Predictable and explainable to users
- Fast — no model inference overhead
- Easy for admin to adjust thresholds

**Future Phase:** When enough fraud history accumulates in `Violation_Records` and `Cancellation_Logs`, an ML anomaly detection model can be trained on top of the same data without changing the database structure.

---

## 6. Veriff Integration Plan *(Planned)*

**Where it fits:**

```
Seller Setup (Step 4: ID Verification)
    ↓
POST /api/verification/start-session   ← backend creates Veriff session
    ↓
Veriff SDK loaded in browser           ← user submits government ID + selfie
    ↓
Veriff webhook → POST /api/verification/webhook  ← backend receives result
    ↓
UPDATE ID_Verifications table          ← store verification status
    ↓
UPDATE Seller.is_verified = true       ← unlock seller features
```

**Files to create:**
- `/backend/services/veriffService.js` — session creation, HMAC webhook validation
- `/backend/routes/verification.routes.js` — `/start-session`, `/webhook`, `/status`
- `/backend/controllers/verificationController.js` — request handlers
- `/src/app/seller/setup/` — update step 4 UI to embed Veriff SDK modal

**Environment variables to add:**
```
VERIFF_API_KEY=your_api_key
VERIFF_SECRET=your_secret_key
VERIFF_BASE_URL=https://stationapi.veriff.com
```

---

## 6. Admin Panel Plan *(Planned)*

**Where it fits:**

```
/admin/*  (Next.js pages)
    ↓
Admin Middleware (role = 'admin' check)
    ↓
/api/admin/* routes
    ↓
adminService.js  (aggregates across all tables)
    ↓
Supabase (read/write with service role key)
```

**Admin Capabilities:**
- User management: view, suspend, ban, restore accounts
- Seller management: approve/reject sellers, revoke verification
- Auction oversight: pause or end any live auction
- Violation management: review reports, adjust strikes, resolve appeals
- Platform analytics: revenue, DAU, auction completion rates, GMV
- Audit logs: full trail of all admin actions

**Files to create:**
- `/src/app/admin/` — admin pages (users, auctions, violations, analytics)
- `/backend/routes/admin.routes.js` — all admin API routes
- `/backend/controllers/adminController.js` — admin handlers
- `/backend/services/adminService.js` — admin business logic
- `/backend/middleware/adminMiddleware.js` — role-based access guard

---

## 7. Environment Variables Reference

### Frontend (`/.env.local`)
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000
NEXT_PUBLIC_AGORA_APP_ID=<agora_app_id>
```

### Backend (`/backend/.env`)
```
PORT=5000
SUPABASE_URL=<supabase_project_url>
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
JWT_SECRET=<strong_secret>
AGORA_APP_ID=<agora_app_id>
AGORA_APP_CERTIFICATE=<agora_certificate>
GEMINI_API_KEY=<google_gemini_key>

# Planned
VERIFF_API_KEY=<veriff_key>
VERIFF_SECRET=<veriff_secret>
PAYMONGO_SECRET_KEY=<paymongo_key>
SENDGRID_API_KEY=<sendgrid_key>
SEMAPHORE_API_KEY=<semaphore_key>
REDIS_URL=<redis_connection_url>
LOGISTICS_API_KEY=<courier_api_key>
```

---

## 8. Data Flow Summary

```
User Action (Browser)
        │
        ▼
Next.js Frontend (src/)
  ├─ React components render UI
  ├─ AuthContext / CartContext manage state
  └─ fetch() / Socket.IO client sends requests
        │
        ▼
Express API (backend/server.js :5000)
  ├─ Auth Middleware validates JWT
  ├─ Router matches endpoint
  ├─ Violation Service checks bid eligibility (rule-based)  ← before bid is saved
  ├─ Controller handles business logic
  ├─ Strike Engine escalates violations (warn → restrict → suspend → ban)
  ├─ Service handles complex operations (AI, ML, Veriff, Logistics)
  ├─ Redis Cache checked before hitting database (planned)
  └─ Supabase client executes DB queries
        │
        ▼ (background, every hour)
Payment Window Checker (cron job)
  └─ Flags unpaid orders → triggers strikeEngine.js → updates Violation_Records
        │
        ▼
Data Layer
  ├─ Supabase (PostgreSQL) → permanent storage
  ├─ Redis → active auction cache, sessions (planned)
  └─ BullMQ → payment jobs, email/SMS dispatch (planned)
        │
        ▼ (parallel, for real-time)
Socket.IO Server
  └─ Broadcasts events (bids, viewer count, comments) to connected clients

External Services (called from backend):
  ├─ Agora          → live stream token generation
  ├─ Google Gemini  → AI price analysis
  ├─ Google OAuth   → social authentication
  ├─ Google Maps    → location display
  ├─ Veriff         → government ID verification (planned)
  ├─ PayMongo       → payment processing (planned)
  ├─ J&T / Ninja Van → shipment booking + tracking (planned)
  ├─ SendGrid       → transactional emails (planned)
  └─ Semaphore      → SMS notifications (planned)
```
