# 🎬 MovieMint

A full-stack movie ticket booking platform built with React, Node.js, and MongoDB. Browse now-playing and upcoming movies, select seats in an interactive theater layout, pay securely with Stripe, and receive PDF tickets with QR codes via email.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [API Endpoints](#api-endpoints)
- [Database Models](#database-models)
- [Deployment](#deployment)

---

## Features

### User-Facing
- **Movie Discovery** — Browse now-playing and upcoming movies powered by TMDB
- **Movie Details** — Trailers, cast, genres, runtime, ratings, and taglines
- **Interactive Seat Selection** — Color-coded seat categories (Executive, Club, Royale) with real-time availability
- **Multiple Formats** — 2D, 3D, IMAX 2D, 4DX-3D with format-based pricing
- **10-Minute Seat Hold** — Selected seats are temporarily reserved while you complete payment
- **Secure Payments** — Stripe Checkout integration with webhook-based confirmation
- **PDF Tickets with QR Code** — Auto-generated and emailed after successful payment
- **Favorites** — Save movies to a personal favorites list
- **Booking History** — View all past and upcoming bookings with live countdown timers

### Admin Panel
- **Dashboard** — Real-time stats: total bookings, revenue, active shows, registered users
- **Show Management** — Create, edit, hide/unhide shows across theaters and dates
- **Auto-Scheduling** — Automatically generate shows for new releases across all theaters for 120 days
- **Booking Management** — Filter and view all bookings by status, date range, with pagination
- **Maintenance Tools** — Reset auto-generated shows, clear stuck pending bookings

---

## Tech Stack

| Layer       | Technology                                                                 |
|-------------|---------------------------------------------------------------------------|
| Frontend    | React 19, React Router 7, Vite, Tailwind CSS                             |
| Backend     | Node.js, Express 5                                                        |
| Database    | MongoDB (Mongoose)                                                        |
| Auth        | Clerk (frontend SDK + Express middleware + webhook sync)                  |
| Payments    | Stripe (Checkout Sessions + Webhooks)                                     |
| Email       | Nodemailer with Brevo SMTP relay                                          |
| PDF/QR      | PDFKit, qrcode                                                           |
| Task Queue  | Inngest (async ticket generation, payment expiry checks, Clerk user sync) |
| Cron        | node-cron (expired booking cleanup every 2 minutes)                       |
| Deployment  | Vercel (both client SPA and server as serverless functions)               |

---

## Project Structure

```
MovieMint/
├── client/                     # React frontend
│   ├── src/
│   │   ├── assets/             # Logo, images, seed data
│   │   ├── components/         # Reusable UI components
│   │   │   └── admin/          # Admin-specific components
│   │   ├── context/            # React context (AppContext)
│   │   ├── lib/                # Utility functions (date/time formatting)
│   │   └── pages/              # Route pages
│   │       └── admin/          # Admin pages (Dashboard, Shows, Bookings)
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Express backend
│   ├── configs/                # DB connection, email transporter
│   ├── controllers/            # Route handlers
│   ├── cron/                   # Scheduled jobs (expire tickets)
│   ├── inngest/                # Async event functions
│   ├── middleware/              # Auth middleware
│   ├── models/                 # Mongoose schemas
│   ├── routes/                 # Express routers
│   ├── uploads/tickets/        # Generated PDF tickets
│   ├── utils/                  # Ticket PDF generator
│   ├── server.js
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **MongoDB** (Atlas or local)
- **Stripe** account (for payments)
- **Clerk** account (for authentication)
- **Brevo** account (for transactional emails)
- **TMDB API key** (for movie data)

### Environment Variables

**Client** — create `client/.env.local`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p/original
VITE_CURRENCY=$
VITE_API_BASE_URL=http://localhost:3000
```

**Server** — create `server/.env`:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/moviemint
TMDB_API_KEY=your_tmdb_api_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=usd
SMTP_USER=your_brevo_smtp_user
SMTP_PASS=your_brevo_smtp_password
SENDER_EMAIL=noreply@yourdomain.com
BOOKING_HOLD_MINUTES=10
CLIENT_URL=http://localhost:5173
PORT=3000
```

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/MovieMint.git
cd MovieMint

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Running Locally

```bash
# Terminal 1 — Start the backend
cd server
npm run server       # Runs on http://localhost:3000

# Terminal 2 — Start the frontend
cd client
npm run dev          # Runs on http://localhost:5173
```

> **Seed theaters:** The seed endpoint (`/api/seed/seed-theaters`) requires admin authentication. Log in as an admin user first, then call the endpoint to populate theater data.

---

## API Endpoints

### Shows

| Method | Endpoint                         | Description                     | Auth    |
|--------|----------------------------------|---------------------------------|---------|
| GET    | `/api/show`                      | All shows                       | —       |
| GET    | `/api/show/:movieId`             | Shows for a specific movie      | —       |
| GET    | `/api/show/now-playing`          | Now playing movies (TMDB)       | Admin   |
| GET    | `/api/show/upcoming`             | Upcoming movies (TMDB)          | —       |

### Bookings

| Method | Endpoint                         | Description                     | Auth    |
|--------|----------------------------------|---------------------------------|---------|
| POST   | `/api/booking/create`            | Create a pending booking        | User    |
| GET    | `/api/booking/:bookingId`        | Get booking details             | User    |
| GET    | `/api/booking/seats/:showId`     | Seat availability snapshot      | —       |
| GET    | `/api/booking/seats/stream`      | SSE stream of seat updates      | —       |
| POST   | `/api/booking/confirm-booking`   | Confirm booking after payment   | User    |
| GET    | `/api/booking/:bookingId/ticket` | Download ticket PDF             | User    |

### Users

| Method | Endpoint                         | Description                     | Auth    |
|--------|----------------------------------|---------------------------------|---------|
| GET    | `/api/user/bookings`             | User's booking history          | User    |
| POST   | `/api/user/update-favorite`      | Toggle favorite movie           | User    |
| GET    | `/api/user/favorites`            | Get user's favorites            | User    |

### Admin

| Method | Endpoint                         | Description                     | Auth    |
|--------|----------------------------------|---------------------------------|---------|
| GET    | `/api/admin/is-admin`            | Check admin role                | User    |
| GET    | `/api/admin/dashboard`           | Dashboard stats                 | Admin   |
| GET    | `/api/admin/all-shows`           | List all shows                  | Admin   |
| GET    | `/api/admin/all-bookings`        | List all bookings               | Admin   |
| POST   | `/api/admin/booking/clear-stuck` | Clear stuck pending bookings    | Admin   |

### Stripe

| Method | Endpoint                              | Description                 | Auth    |
|--------|---------------------------------------|-----------------------------|---------|
| POST   | `/api/stripe`                         | Stripe webhook receiver     | Stripe  |

---

## Database Models

### Movie
Core movie data synced from TMDB, extended with admin configuration: `showTimesTemplate`, `priceByFormat`, `autoScheduleEnabled`, `defaultShowPrice`.

### Show
Represents a single screening: linked to a movie and theater, tracks `occupiedSeats` (confirmed) and `heldSeats` (pending), supports format/experience types and visibility toggling.

### Booking
Tracks user bookings with Stripe payment status, seat hold expiry, ticket PDF path, and user snapshot at booking time. Statuses: `pending` → `confirmed` | `cancelled`.

### Theater
Theater locations with name, city, address, supported formats, and amenities.

### User
Synced from Clerk via webhooks. Stores Clerk user ID as `_id`, along with name, email, and profile image.

---

## Deployment

Both client and server are configured for **Vercel**:

- **Client** — Deploys as a static SPA with client-side routing (catch-all rewrite to `index.html`)
- **Server** — Deploys as a serverless Node.js function with all routes handled by `server.js`

```bash
# Deploy client
cd client
vercel --prod

# Deploy server
cd server
vercel --prod
```

Make sure to configure all environment variables in the Vercel dashboard for both projects.

---

## License

This project is for educational and personal use.
