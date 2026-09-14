# 🎱 EXTRABLACK Snooker Manager — Complete Project Structure & Architecture Guide

> **Production-grade Snooker & Pool Club Management System**  
> Built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS 4**, and a full-stack **Express** backend featuring real-time Server-Sent Events (SSE) and triple-sync cloud persistence (**MongoDB Atlas + Cloud Firestore + Google Sheets**).

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Complete Directory & File Tree](#2-complete-directory--file-tree)
3. [Environment Configuration (.env Guide)](#3-environment-configuration-env-guide)
4. [Data Models & Persistence Architecture](#4-data-models--persistence-architecture)
5. [Backend API Endpoints Reference](#5-backend-api-endpoints-reference)
6. [Frontend Views & Component Hierarchy](#6-frontend-views--component-hierarchy)
7. [Localhost Setup & Run Guide](#7-localhost-setup--run-guide)

---

## 1. Architecture Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         REACT 19 FRONTEND (Vite)                       │
 │  Dashboard (Live Tables) • Loans • Customers • Reports • Admin/Staff   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP REST + SSE Stream
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         EXPRESS SERVER (Node.js)                       │
 │       Auth & Session Guard • Rate Limiting • Game Lifecycle Logic      │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────────┐
│ In-Memory Map │            │ MongoDB Atlas │            │  Cloud Firestore  │
│  Fast Cache   │◄──────────►│ Primary Store │◄──────────►│ Real-Time Mirror  │
└───────────────┘            └───────────────┘            └───────────────────┘
                                     │
                                     ▼
                             ┌───────────────┐
                             │ Google Sheets │
                             │ Live Backup   │
                             └───────────────┘
```

- **Frontend**: Single Page Application (SPA) with React 19, Lucide React icons, Tailwind CSS 4, multi-language support (FR / AR / EN), and Progressive Web App (PWA) offline installability.
- **Backend API**: Express on Node.js / `tsx`, providing REST endpoints and Server-Sent Events (`/api/dashboard/stream`) for multi-device live sync.
- **Data Layer**: High-availability in-memory repository backed by continuous, non-blocking hydration and replication across **MongoDB Atlas**, **Google Cloud Firestore**, and **Google Sheets API**.

---

## 2. Complete Directory & File Tree

```text
├── .env.example                     # Environment variables schema & documentation template
├── metadata.json                    # Application metadata, frame permissions & capabilities
├── package.json                     # Dependencies, build & start scripts
├── tsconfig.json                    # TypeScript compiler configuration
├── tsconfig.node.json               # TypeScript config for Node/Vite tooling
├── vite.config.ts                   # Vite configuration with React, Tailwind, and PWA plugins
├── index.html                       # Entry HTML template with PWA manifest headers & meta tags
├── PROJECT_STRUCTURE.md             # This comprehensive architecture & structure manual
├── server.ts                        # Main Express backend server, REST API & SSE streaming routes
│
├── public/                          # Static assets
│   ├── favicon.ico
│   ├── icon-192.png                 # PWA application icon (192x192)
│   ├── icon-512.png                 # PWA application icon (512x512)
│   └── manifest.webmanifest         # PWA Web Application Manifest
│
└── src/
    ├── main.tsx                     # React root bootstrap entry point
    ├── App.tsx                      # Root React container, tab routing, auth wrapper & header
    ├── types.ts                     # TypeScript shared interfaces, models & enums
    ├── index.css                    # Global Tailwind CSS entry (@import "tailwindcss")
    │
    ├── components/                  # UI components grouped by business domain
    │   ├── admin/
    │   │   ├── AuditLogsView.tsx         # Comprehensive audit trail & security activity table
    │   │   ├── DatabaseInspectorView.tsx # Raw database inspector across in-memory, Mongo & Firestore
    │   │   ├── DiagnosticsView.tsx       # Live diagnostic suite for databases, network & auth
    │   │   └── StaffUsersManager.tsx     # Staff & Admin user accounts management & PIN setups
    │   │
    │   ├── auth/
    │   │   └── LoginView.tsx             # Staff/Admin login view (Google OAuth, PIN, or Email)
    │   │
    │   ├── common/
    │   │   ├── DeleteMistakeModal.tsx    # Secure mistake deletion modal with Admin PIN verification
    │   │   ├── Header.tsx                # Top navigation bar, session indicators, language & theme
    │   │   ├── LanguageSelector.tsx      # Multi-language switcher (FR, AR, EN)
    │   │   ├── Modal.tsx                 # Accessible, animated base dialog component
    │   │   └── PWAInstallButton.tsx      # One-click PWA desktop/mobile installation button
    │   │
    │   ├── customers/
    │   │   └── CustomersManager.tsx      # Customer directory, contact cards, and visit histories
    │   │
    │   ├── dashboard/
    │   │   ├── CloudSyncStatus.tsx       # Real-time multi-database sync status pill & indicators
    │   │   ├── DashboardView.tsx         # Live floor view: Mini 1 & Mini 2 tables, quick stats & waiting list
    │   │   └── LiveTableCard.tsx         # Interactive table card: live timer, price counter & frame control
    │   │
    │   ├── games/
    │   │   ├── EndGameModal.tsx          # Bill game modal (Cash, Loan/Credit, Pay-Later, Promo, Mistake delete)
    │   │   ├── GameDetailEditModal.tsx   # Edit game players, frame counts, and pricing notes
    │   │   └── StartGameModal.tsx        # Start new game on Mini 1 or Mini 2 with player auto-suggest
    │   │
    │   ├── loans/
    │   │   └── LoansManager.tsx          # Credit (Salaf) manager: debtor list, payment collection & history
    │   │
    │   ├── reports/
    │   │   ├── CalendarDayReportView.tsx # Daily financial breakdown, hourly breakdown & game list
    │   │   ├── ReportsView.tsx           # Multi-day analytics, revenue graphs & export tools
    │   │   └── UserSessionsReportView.tsx# Worker shift activity logs and collected cash breakdown
    │   │
    │   ├── sessions/
    │   │   └── CloseSessionModal.tsx     # Shift closing modal with revenue summary & cash confirmation
    │   │
    │   └── waiting/
    │       └── WaitingListManager.tsx    # Waiting queue management with table assignments
    │
    ├── lib/                         # Client-side helpers, state hooks & API clients
    │   ├── api.ts                   # Centralized API fetch wrapper with typed methods
    │   ├── authContext.tsx          # React Context for authentication state, login & logout
    │   ├── dateUtils.ts             # Morocco / Casablanca timezone date formatting utilities
    │   ├── firebase.ts              # Firebase client SDK initialization & Firestore references
    │   ├── pricing.ts               # Snooker pricing algorithms, frame calculations & promotions
    │   ├── time.ts                  # High-precision timer and stopwatch utilities
    │   ├── useFirestoreStream.ts    # React hook for listening to SSE and Firestore live streams
    │   ├── usePWAInstall.ts         # Hook detecting `beforeinstallprompt` event for PWA installation
    │   │
    │   └── i18n/                    # Localization system
    │       ├── index.tsx            # I18n provider & locale store
    │       ├── translations.ts      # Multi-language dictionary (French, Arabic, English)
    │       └── useTranslation.ts    # Hook for accessing translation strings
    │
    └── server/                      # Server-side business logic, storage & database drivers
        ├── auth.ts                  # Session tokens, Google OAuth verification, PIN validation
        ├── firestore.ts             # Google Cloud Firestore SDK driver, collections & live listeners
        ├── googleSheets.ts          # Google Sheets API backup synchronization service
        ├── mongodb.ts               # MongoDB Atlas driver, collection schemas & change streams
        └── storage.ts               # Core memory repository, business rules, pricing & overnight safeguards
```

---

## 3. Environment Configuration (.env Guide)

Create a `.env` file in the project root for local execution.

### Complete `.env` Copy-Paste Template:
```env
# ==============================================================================
# EXTRABLACK Snooker Manager — Local Environment Configuration
# ==============================================================================

# Server Network Configuration
PORT=3000
NODE_ENV="development"
APP_URL="http://localhost:3000"

# Timezone (Casablanca UTC+1 / Standard)
TZ="Africa/Casablanca"

# Super Administrator Account
ADMIN_EMAIL="astro.dev.it@gmail.com"

# Security: Master Deletion PIN (Used by workers for mistake deletions & audit overrides)
MASTER_DELETION_PIN="753159"

# Session Security (32+ character random string for signing HTTP cookies)
SESSION_SECRET="extrablack-snooker-jwt-secret-key-32chars-min"

# ------------------------------------------------------------------------------
# PRIMARY DATABASE: MongoDB Atlas
# ------------------------------------------------------------------------------
MONGODB_URI="mongodb+srv://astrodevit_db_user:n61seg3lttOcXkMJ@cluster0.9jwyvih.mongodb.net"
MONGODB_DB_NAME="extrablack_snooker"

# ------------------------------------------------------------------------------
# SECONDARY BACKUP: Google Sheets API (Optional but recommended)
# ------------------------------------------------------------------------------
GOOGLE_SHEETS_SPREADSHEET_ID=""
GOOGLE_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=""

# ------------------------------------------------------------------------------
# AUTHENTICATION: Google OAuth 2.0 (Optional for 1-click Google Sign-in)
# ------------------------------------------------------------------------------
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ------------------------------------------------------------------------------
# AI FEATURES: Gemini API (Optional)
# ------------------------------------------------------------------------------
GEMINI_API_KEY=""
```

### Environment Variables Details & Purpose:

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `3000` | Port on which the Express server binds. |
| `NODE_ENV` | Optional | `development` | `development` or `production`. Controls Vite middleware vs static serving. |
| `TZ` | Optional | `Africa/Casablanca` | Ensures server timestamps and daily shift calculations match local venue time. |
| `ADMIN_EMAIL` | Required | `astro.dev.it@gmail.com` | Email address granted perpetual `SUPER_ADMIN` privileges. |
| `MASTER_DELETION_PIN`| Required | `753159` | Master security code required when a non-admin worker deletes a game. |
| `SESSION_SECRET` | Required | Any 32-char string | Secret key used by `cookie-parser` to sign and encrypt session cookies. |
| `MONGODB_URI` | **Required** | `mongodb+srv://...` | Connection URI for the primary MongoDB Atlas database cluster. |
| `MONGODB_DB_NAME` | **Required** | `extrablack_snooker` | Database name where games, loans, customers, and sessions are stored. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Optional | Spreadsheet ID | Spreadsheet ID where backup rows are mirrored in real-time. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Optional | `sa@project.iam.gserviceaccount.com` | Google Cloud Service Account with Sheets read/write permissions. |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Optional | `-----BEGIN PRIVATE KEY-----\n...` | RSA private key for the service account. |
| `GOOGLE_CLIENT_ID` | Optional | `*.apps.googleusercontent.com` | Google OAuth Client ID for Google Sign-in button. |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | API key for automated operational insights and analytics. |

---

## 4. Data Models & Persistence Architecture

Defined in `/src/types.ts`:

1. **`Table`**: Physical tables (`MINI1`, `MINI2`) with status (`LIBRE`, `OCCUPIED`, `MAINTENANCE`), minute rates, and default frame counts.
2. **`Game`**: Individual match records with `start_time`, `end_time`, `duration_minutes`, `raw_calculated_price`, `final_price`, `payment_status` (`PAID`, `PAY_LATER`, `LOAN`, `PENDING`), `status` (`RUNNING`, `CLOSED`, `CANCELLED`), and `games_count` (1–9).
3. **`DailySession`**: Shift container tracking `total_games`, `total_paid`, `new_loans`, `mini1_revenue`, `mini2_revenue`, `reste`, and `status` (`OPEN`, `CLOSED`).
4. **`Loan`**: Credit (Salaf) tracking debtor `player_name`, `amount`, `status` (`OPEN`, `PAID`, `CANCELLED`), and collection timestamps.
5. **`Customer`**: Player registry with normalized search tokens, visit frequency, and accumulated statistics.
6. **`User`**: Staff and Admin user accounts with role permissions (`ADMIN`, `WORKER`), emails, and custom login PINs.
7. **`WaitingEntry`**: Queue entry for players waiting for `MINI1`, `MINI2`, or `ANY`.
8. **`AuditEntry`**: Immutable record of sensitive actions (game deletions, price overrides, setting changes, failed PIN attempts).

---

## 5. Backend API Endpoints Reference

All routes are hosted under `/api/*` in `server.ts`:

### Authentication & Users
- `GET /api/auth/me` — Retrieve current logged-in user profile.
- `POST /api/auth/login-pin` — Fast 4-digit PIN login for staff.
- `POST /api/auth/email` — Direct email authentication.
- `POST /api/auth/google` — Google OAuth credential login.
- `POST /api/auth/logout` — Invalidate session and clear auth cookies.
- `GET /api/users` & `POST /api/users` — Manage staff accounts and PINs.

### Dashboard & Live Sync
- `GET /api/dashboard` — Complete snapshot of tables, active games, session totals, open loans, and waiting list.
- `GET /api/dashboard/stream` — Real-time Server-Sent Events (SSE) stream for instant multi-client updates.

### Games Management
- `POST /api/games/start` — Start a game on Mini 1 or Mini 2.
- `POST /api/games/end` — End a game, select payment type (Cash, Pay-Later, Loan, Free Promo).
- `DELETE /api/games/:id` — Secure mistake deletion (requires Admin role or Master PIN with rate limiting).
- `PATCH /api/games/:id/games-count` — Modify frame count (1–9) during or after a match.
- `PATCH /api/games/:id/players` — Correct player names entered by mistake.
- `GET /api/games` & `GET /api/games/:id` — Query and filter historical game records.

### Sessions & Shifts
- `GET /api/sessions/current` — Get active open shift.
- `POST /api/sessions/close` — Close daily session, verify cash, and auto-stop active games.
- `GET /api/sessions` — Retrieve shift history across all days.

### Loans & Customers
- `GET /api/loans` & `POST /api/loans/:id/pay` — View and settle credit/salaf debts.
- `GET /api/customers` & `POST /api/customers` — Search and manage registered players.

### Reports & Diagnostics
- `GET /api/reports/day/:date` — Detailed hourly, financial, and table breakdown for any date.
- `GET /api/diagnostics` — Live health check for MongoDB, Firestore, Google Sheets, and memory cache.

---

## 6. Frontend Views & Component Hierarchy

- **Header (`Header.tsx`)**: Displays club branding, active shift indicator, live clock, language selector, and user profile badge.
- **Main Views (Routed via App state)**:
  - **`DashboardView`**: Floor view with large visual cards for `MINI1` and `MINI2`, active stopwatch, frame selector, and quick actions.
  - **`LoansManager`**: Tabular and card view of outstanding player credits with instant one-click payment collection.
  - **`CustomersManager`**: Directory of frequent players with search by name/phone and direct match launch buttons.
  - **`WaitingListManager`**: Queue for waiting players with automatic table assignment.
  - **`ReportsView` & `CalendarDayReportView`**: Revenue summaries, hourly graphs, and Excel/Sheets export buttons.
  - **`StaffUsersManager`**: Admin panel for creating workers, assigning 4-digit PINs, and auditing shift logins.
  - **`DiagnosticsView` & `DatabaseInspectorView`**: System health monitor and direct document inspector.

---

## 7. Localhost Setup & Run Guide

### Prerequisites:
- **Node.js**: `v20.x` or `v22.x` installed.
- **NPM**: `v10.x` or higher.

### Step-by-Step Instructions:

1. **Clone or Navigate to the Workspace**:
   ```bash
   cd /path/to/extrablack-snooker
   ```

2. **Configure Environment Variables**:
   Create your `.env` file from the provided template:
   ```bash
   cp .env.example .env
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   *The application starts on `http://localhost:3000` with Express backend and Vite React frontend middleware running simultaneously.*

5. **Type Check & Lint**:
   ```bash
   npm run lint
   ```

6. **Build for Production**:
   ```bash
   npm run build
   ```
   *Builds the React client to `dist/` and bundles the Express server to `dist/server.cjs` using `esbuild`.*

7. **Run Production Server**:
   ```bash
   npm run start
   ```

---
*Maintained for EXTRABLACK Snooker Club — Casablanca.*
