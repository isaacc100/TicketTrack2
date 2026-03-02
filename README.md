# 🍽️ TicketTrack2

A web-based, multi-terminal restaurant Point of Sale (POS) system built with Next.js 14, PostgreSQL, and Socket.io. Designed for real-time operation across FOH, Kitchen Display, Pickup, and Manager terminals with a touchscreen-optimised interface.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
  - [Authentication & Users](#authentication--users)
  - [Permission System](#permission-system)
  - [FOH Terminal](#foh-terminal)
  - [Menu System](#menu-system)
  - [Kitchen Display System (KDS)](#kitchen-display-system-kds)
  - [Pickup Screen](#pickup-screen)
  - [Checkout](#checkout)
  - [Manager Terminal](#manager-terminal)
  - [Auditing](#auditing)
  - [Security](#security)
  - [Reliability](#reliability)
- [Getting Started](#getting-started)
- [Development](#development)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Future Roadmap](#future-roadmap)

---

## Overview

TicketTrack2 is a self-hosted, browser-accessible POS system designed for restaurant environments. It supports multiple concurrent terminals, real-time synchronisation, role-based access control, and full audit logging — all backed by a centralised PostgreSQL database.

Key design goals:
- **Real-time** — Socket.io keeps all terminals in sync instantly
- **Resilient** — Persistent DB state survives power loss and browser crashes
- **Auditable** — Every action is immutably logged with before/after state
- **Touchscreen-first** — UI designed for tablets and touchscreen displays
- **Self-hosted** — Full Docker-based deployment with no external dependencies

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL + Prisma ORM |
| Real-time | Socket.io (custom `server.ts`) |
| Styling | Tailwind CSS |
| Auth | bcryptjs (PIN hashing) + jose (JWT HS256) |
| Validation | Zod |
| Deployment | Docker + Docker Compose |

---

## ✨ Features

### Authentication & Users

- **4 or 6-digit PIN codes** — randomly generated, enforced unique across all staff
- **Login lockout** — configurable max attempts and lockout duration
- **Auto session timeout** — configurable idle timeout with automatic logout
- **User activation/deactivation** — Rank 0 disables access without deleting the account
- **PIN regeneration** — managers can issue new PINs via the manager panel
- **Login/logout auditing** — every session event is recorded with terminal ID and timestamp

### Permission System

Staff are assigned a rank (0–7) which maps to a set of granular permissions.

| Rank | Role | Description |
|---|---|---|
| 0 | Deactivated | No access |
| 1 | View Only | Read-only access |
| 2 | Kitchen | KDS access only |
| 3 | FOH | Create/edit orders, checkout |
| 4–6 | Custom | Configurable per-deployment |
| 7 | Administrator | Full access |

**Available permissions:**

`CREATE_ORDER` · `EDIT_ORDER` · `VOID_ITEM` · `APPLY_DISCOUNT` · `MARK_PRIORITY` · `CHECKOUT` · `CLOSE_DAY` · `MANAGE_USERS` · `EDIT_MENU` · `EDIT_TABLES` · `EDIT_SETTINGS` · `VIEW_AUDIT` · `EXPORT_REPORTS` · `OVERRIDE`

### FOH Terminal

Routes: `/tables`, `/orders`, `/checkout`

- **Visual floorplan** — table status indicators: Available / Occupied / Awaiting / Ready / Paid / Reserved / Dirty
- **Multiple tabs per table** — optional tab naming per tab
- **Allergen prompt** — shown on tab creation, editable at any time (all edits logged)
- **Order management** — add, remove, and edit items with per-item notes
- **Modifier support** — mandatory modifier groups enforced at order time
- **Priority marking** — permission-gated, surfaced on KDS
- **Real-time KDS updates** — item changes pushed instantly via Socket.io
- **Full audit logging** — every FOH action is recorded

### Menu System

- Multi-category layout with category navigation
- **GUI-based menu editor** in the Manager terminal — no direct DB edits required
- Colour customisation for categories and items
- KDS station routing configured per item
- Modifier groups with mandatory/optional configuration

### Kitchen Display System (KDS)

Route: `/kds`

- Displays: order number, table, items, modifiers, allergy warnings, per-item notes, time elapsed
- **Order acknowledgement** — mark orders as In Progress
- **Station-based filtering** — each KDS terminal can filter to its station
- **Colour-coded time thresholds** — visual urgency indicators
- Mark individual items complete, or complete the full order
- Records completion timestamps per item and per order
- **Undo / reopen** — permission-restricted

### Pickup Screen

Route: `/pickup`

- Shows items that are complete and ready for pickup
- Mark items as taken with logged pickup time
- Toggleable via system configuration

### Checkout

Route: `/checkout/[tabId]`

- Itemised bill view with add/remove pre-payment
- **Discounts** — percentage and fixed amount
- **Split bills** — equal split, custom split, or split by item
- **Tip entry** — fixed amount or percentage
- **Rounding rules** — configurable
- **Payment methods** — Cash (with change calculation), Card, Split payment
- Order locking after payment to prevent double-processing
- Automatic table reset after payment
- Full payment auditing

### Manager Terminal

Route: `/manager`

- **Dashboard** — today's key stats at a glance
- **User management** — create, edit, deactivate staff; regenerate PINs
- **Audit log viewer** — filterable by staff, action, entity, and date range; CSV export
- **Close Day workflow** — open-order guard, Z-report generation
- **Reports** — Z-Report, Sales, Staff Performance, Items, Tables (JSON + CSV export)
- **Menu Editor** — GUI for managing categories and items
- **Table Management** — add, edit, and delete tables
- **Settings** — session timeout, PIN attempt limits, rounding behaviour, and more

### Auditing

All audit records are **immutable** and include: `staffId`, `timestamp`, `terminalId`, `action`, `entityType`, `entityId`, `before`/`after` state, `orderId`.

Logged events include:

| Category | Events |
|---|---|
| Auth | Logins, logouts |
| Orders | Creation, editing |
| Items | Add, remove, modifier changes |
| Allergens | All allergy edits |
| Payments | Discounts, voids, payment actions |
| Manager | Overrides, close day |
| Admin | User/permission edits, config changes |

Audit logs are filterable and exportable as CSV.

### Security

- **HTTPS** enforced in production
- **bcrypt PIN hashing** — salt rounds: 12
- **Role-based access control** on all routes and API endpoints
- **httpOnly secure cookies** for session tokens
- **JWT HS256** with configurable secret and expiry
- **Session expiry** — 30-minute default, auto-logout on inactivity
- **Terminal identification** logged on every request
- **Parameterised queries** via Prisma ORM (SQL injection protection)

### Reliability

- **Crash recovery** — persistent DB state survives power loss or browser crash
- **Duplicate submission prevention** — order locking after payment
- **Concurrent edit handling** — DB transactions prevent race conditions
- **Late allergen alerting** — warnings surfaced on KDS if allergies added after order
- **Void after payment** — manager-only override with full audit trail
- **Every action logged** — nothing happens without a record

---

## 🚀 Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- Node.js 18+ (for local development)

### Production Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd TicketTrack2

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in all required values

# 3. Start services
docker-compose up -d

# 4. Run database migrations
npx prisma migrate deploy

# 5. Seed initial data (creates default admin + menu data)
npx prisma db seed

# 6. Open in browser
# http://localhost:3000
```

### Development Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd TicketTrack2
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — use docker-compose.dev.yml for local DB

# 3. Start the development database
docker-compose -f docker-compose.dev.yml up -d

# 4. Run migrations and seed
npx prisma migrate dev
npx prisma db seed

# 5. Start the development server (Next.js + Socket.io)
npm run dev
```

---

## 💻 Development

```bash
npm run dev     # Start Next.js + Socket.io development server
npm run build   # Production build
npm run lint    # Run ESLint
```

The custom `server.ts` file bootstraps the Socket.io server alongside Next.js. All real-time events are handled here.

---

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tickettrack
DIRECT_URL=postgresql://user:password@localhost:5432/tickettrack

# Auth
JWT_SECRET=your-long-random-secret

# Security
PIN_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=5

# Session
NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES=30

# Terminal
NEXT_PUBLIC_TERMINAL_ID=terminal-1

# App
NODE_ENV=production
PORT=3000
```

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Prisma connection URL (pooled) | — |
| `DIRECT_URL` | Direct DB URL (migrations) | — |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `PIN_MAX_ATTEMPTS` | Failed login attempts before lockout | `5` |
| `LOCKOUT_DURATION_MINUTES` | Lockout duration after max attempts | `5` |
| `NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES` | Idle session timeout | `30` |
| `NEXT_PUBLIC_TERMINAL_ID` | Unique identifier for this terminal | `terminal-1` |
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | Port the server listens on | `3000` |

---

## 📡 API Reference

### Auth

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | PIN login |
| `POST` | `/api/auth/logout` | Logout |

### Tabs

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/tabs` | List tabs |
| `POST` | `/api/tabs` | Create tab |
| `GET` | `/api/tabs/[tabId]` | Get tab |
| `PATCH` | `/api/tabs/[tabId]` | Update tab |

### Orders

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/orders` | List orders |
| `POST` | `/api/orders` | Create order |
| `GET` | `/api/orders/[orderId]` | Get order |
| `PATCH` | `/api/orders/[orderId]` | Update order |
| `GET` | `/api/orders/[orderId]/items` | List order items |
| `POST` | `/api/orders/[orderId]/items` | Add item to order |
| `DELETE` | `/api/orders/[orderId]/items` | Remove item from order |

### Menu

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/menu/categories` | List categories |
| `POST` | `/api/menu/categories` | Create category |
| `GET` | `/api/menu/categories/[categoryId]` | Get category |
| `PUT` | `/api/menu/categories/[categoryId]` | Update category |
| `DELETE` | `/api/menu/categories/[categoryId]` | Delete category |
| `GET` | `/api/menu/items` | List items |
| `POST` | `/api/menu/items` | Create item |
| `GET` | `/api/menu/items/[itemId]` | Get item |
| `PUT` | `/api/menu/items/[itemId]` | Update item |
| `DELETE` | `/api/menu/items/[itemId]` | Delete item |

### Tables

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/tables` | List tables |
| `POST` | `/api/tables` | Create table |
| `GET` | `/api/tables/[tableId]` | Get table |
| `PUT` | `/api/tables/[tableId]` | Update table |
| `DELETE` | `/api/tables/[tableId]` | Delete table |

### Checkout

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/checkout/[tabId]` | Get checkout details |
| `POST` | `/api/checkout/[tabId]` | Process payment |
| `GET` | `/api/checkout/[tabId]/balance` | Get tab balance |

### KDS

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/kds/orders` | KDS order feed |
| `GET` | `/api/kds/stations` | KDS stations |
| `PATCH` | `/api/kds/items/[itemId]` | Update KDS item status |
| `GET` | `/api/kds/pickup` | Pickup items |

### Admin

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/admin/staff` | List staff |
| `POST` | `/api/admin/staff` | Create staff |
| `GET` | `/api/admin/staff/[staffId]` | Get staff member |
| `PATCH` | `/api/admin/staff/[staffId]` | Update staff member |
| `POST` | `/api/admin/staff/[staffId]` | Staff actions (e.g. PIN reset) |
| `GET` | `/api/admin/audit` | Query audit logs (supports CSV export) |
| `GET` | `/api/admin/config` | Get system configuration |
| `PUT` | `/api/admin/config` | Update system configuration |
| `GET` | `/api/admin/day-close` | Get day-close status |
| `POST` | `/api/admin/day-close` | Execute close day |
| `GET` | `/api/admin/reports` | Generate reports (supports CSV export) |

### System

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |

---

## 🔮 Future Roadmap

The system is designed to accommodate the following enhancements:

- **Inventory** — stock tracking, low-stock alerts, supplier management
- **Reservations** — booking integration with table assignment
- **Customer profiles** — loyalty system, order history
- **QR ordering** — customer-facing QR code menu and ordering
- **Online ordering** — integration with delivery platforms
- **Multi-site** — single platform managing multiple venues
- **Hardware integrations** — receipt printing, kitchen print fallback, barcode scanning
- **Analytics** — cloud-based reporting and dashboards
- **External APIs** — third-party integrations (accounting, EPOS, etc.)
