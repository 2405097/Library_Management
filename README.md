# 📚 Library Management System

Library management project using the **PERN stack** (PostgreSQL, Express, React, Node.js).

> CSE216 Database Sessional Project  
> **Authors:** Wasee & Nira  
> **Repository:** https://github.com/2405097/Library_Management

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Frontend Overview](#frontend-overview)
- [Design Decisions](#design-decisions)
- [Authors](#authors)

---

## Overview

A full-stack library platform where members can browse a catalog, borrow or buy books, join waitlists, manage reading lists, and leave reviews. Administrators get a dashboard to approve signups, manage inventory, process borrow/return/order requests, and handle late fines.

The book catalog is seeded from the [Open Library API](https://openlibrary.org/developers/api). The client also uses it to fetch cover images and synopses.

---

## Features

### 👤 Members
- **Sign up and log in.** New accounts must be approved by an admin before they can log in.
- **Search** by title, book ID, genre, author, or publisher.
- **Browse** a "Most popular" shelf and 11 genre shelves. Results can be sorted by price, popularity, or rating.
- **Book detail page** with a rating breakdown, reviews, related books, and Open Library data.
- **Borrow** an available book. The request stays pending until an admin approves it.
- **Waitlist:** join a borrow list when no copies are left, and leave it at any time.
- **Return requests** for borrowed books.
- **Purchase orders** drawn from a separate sales stock.
- **Wishlists** with three lists: *Currently Reading*, *Want to Read*, and *Favorites*.
- **Book reviews** (only for books the member has borrowed or bought) and general library feedback.
- **Profile management:** edit the bio and details, change the password, and delete the account (password required).

### 🛠️ Admins
- KPI dashboard showing users, books, active and pending borrows, orders, and reviews.
- Signup approval.
- Book inventory: add, edit, and delete books, and manage stock levels.
- Borrow workflow: approve or reject requests, process returns, and calculate overdue fines automatically.
- Fine handling: record payments or waive fines.
- Order workflow: approve or reject orders. Rejecting an order puts its copies back in stock.
- View all book reviews and library feedback.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL (`pg` Pool, stored procedures/functions) |
| Backend | Node.js, Express 5 (ES modules) |
| Auth | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, server-side token revocation |
| Frontend | React 19, Vite, ESLint 9 |
| External | Open Library API |

---

## Architecture

```
Browser (React, :5173)
    │
    │  /api/*  (Vite dev proxy → :4000)
    ▼
Express App (:4000)
    │
    ├── authenticate        (JWT verify + revoked-token check)
    ├── authorize('ADMIN') | authorizeSelfOrAdmin
    │
    └── Routes → Controllers → Models → PostgreSQL
```

### Authentication Flow
1. `POST /api/users/login` checks the bcrypt password hash and the `isApproved` flag, then returns a signed JWT (valid for 7 days by default).
2. Each protected request sends the header `Authorization: Bearer <token>`.
3. `POST /api/users/logout` adds the token to the `REVOKED_TOKEN` blacklist.
4. The `authenticate` middleware checks the token's signature and whether it has been revoked.

On the client, the JWT is stored in `sessionStorage` as `library_token` and the user object as `library_user`.

---

## Project Structure

```
Library_Management/
├── Backend/
│   ├── package.json
│   └── src/
│       ├── index.js                 # Entry: connect DB, run migrations, start server
│       ├── app.js                   # Express app, CORS, JSON, route mounting
│       ├── config/
│       │   ├── database.js          # pg Pool, connectDB(), initializeDatabase()
│       │   └── constants.js
│       ├── database/schema.sql      # DDL + stored procedures/functions
│       ├── middleware/auth.middleware.js
│       ├── Routes/                  # user.route.js, book.route.js, admin.route.js
│       ├── Controllers/user.controller.js
│       ├── Models/user.model.js     # All SQL / DB logic
│       └── scripts/seedBooks.js     # Seed catalog from Open Library
│
└── client/
    ├── package.json
    ├── vite.config.js               # :5173, proxies /api → :4000
    └── src/
        ├── main.jsx
        ├── App.jsx                  # Login → Dashboard | AdminDashboard
        ├── components/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx
        │   ├── BookShelf.jsx
        │   ├── BookPage.jsx
        │   ├── AdminDashboard.jsx
        │   ├── AccountDeletionDialog.jsx
        │   └── PasswordChangeForm.jsx
        ├── utils/bookSorting.js
        └── assets/
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Clone
```bash
git clone https://github.com/2405097/Library_Management.git
cd Library_Management
```

### 2. Backend
```bash
cd Backend
cp .env.example .env
npm install
npm run dev        # nodemon on :4000
```

Set these values in `Backend/.env`:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/postgres
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
PORT=4000
```

On startup, `initializeDatabase()` creates the schema and runs any pending migrations.

### 3. Seed Books (run once)
```bash
node src/scripts/seedBooks.js        # 150 books per genre (default)
node src/scripts/seedBooks.js 200    # custom count per genre
```

### 4. Client
```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

---

## Database Schema

| Table | Primary Key | Description |
|---|---|---|
| `USERS` | `userID` | Profile, role (`MEMBER`/`STAFF`/`ADMIN`), approval status, avatar, bio |
| `CREDENTIALS` | `userID` (FK) | Username, password hash, last login (1:1 with USERS, cascade delete) |
| `PUBLISHER` | `publisherID` | Publisher name, address, contact info |
| `AUTHOR` | `authorID` | Name, biography, nationality, date of birth |
| `BOOK` | `bookID` | Metadata, price, and separate **borrow** and **order** stock counts |
| `BOOK_AUTHOR` | (`bookID`, `authorID`) | Many-to-many link between books and authors |
| `BORROW_RECORD` | `borrowID` | Borrow lifecycle, due date, delay fee |
| `ORDER` | `purchaseNo` | Purchase orders (`PENDING`/`APPROVED`/`REJECTED`) |
| `WISHLIST` | `wishlistID` | `CURRENTLY_READING` / `WANT_TO_READ` / `FAVORITES`; one entry per user, book, and list |
| `BOOK_REVIEW` | `reviewID` | Rating (1–5) and comment |
| `LIBRARY_REVIEW` | `libReviewID` | General library feedback |
| `REVOKED_TOKEN` | `token` | Blacklist of logged-out JWTs |

**Borrow statuses:** `PENDING`, `BORROWED`, `RETURNED`, `OVERDUE`, `LOST`, `REJECTED`, `WAITLISTED`, `FINE_DUE`, `RETURNED_WITH_FINE`, `FINE_WAIVED`

### Stored Procedures & Functions
- `fn_get_book_rating_stats(book_id)` returns the average rating, total rating count, and count for each star level (1–5).
- `borrowBook()` locks the row, checks that borrow copies are available, decrements the count, and inserts a `PENDING` record.
- `addBorrowWaitlist()` / `cancelBorrowWaitlist()` add or remove a waitlist entry.
- `createOrder()` checks order stock and decrements it inside a transaction.
- `rejectBorrow()` / `rejectOrder()` return the reserved copies to stock and set the status to `REJECTED`.

---

## API Reference

### Public

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/users/` | Register |
| POST | `/api/users/login` | Log in and receive a JWT |
| GET | `/api/books/search?field=&keyword=` | Search books |
| GET | `/api/books/popular?limit=10` | Most popular books |
| GET | `/api/books/catalog` | Full catalog |
| GET | `/api/books/:id` | Book details and rating stats |
| GET | `/api/books/:id/reviews` | Book reviews |
| GET | `/api/books/:id/related` | Related books in the same genre |

### Authenticated (self or admin)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/users/logout` | Revoke the JWT |
| GET / PUT | `/api/users/:id` | Get or update a profile |
| DELETE | `/api/users/:id/account` | Delete own account (password required) |
| GET | `/api/users/:id/borrow-records` | Borrow history and waitlist |
| POST | `/api/users/:id/borrow` | Request to borrow |
| POST | `/api/users/:id/borrow-records` | Join the waitlist |
| DELETE | `/api/users/:id/borrow-records/:borrowID` | Leave the waitlist |
| POST | `/api/users/:id/borrow-records/:borrowID/request-return` | Request a return |
| GET / POST | `/api/users/:id/orders` | List or place orders |
| GET / POST | `/api/users/:id/wishlist` | List or add wishlist items |
| PATCH / DELETE | `/api/users/:id/wishlist/:bookID` | Move a book to another list, or remove it |
| GET / POST | `/api/users/:id/book-reviews` | List or submit book reviews |
| GET / POST | `/api/users/:id/library-reviews` | List or submit library feedback |

### Admin only

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/` | List all users |
| POST | `/api/admin/signup-approvals/:id/approve` | Approve a signup |
| GET | `/api/admin/summary` | Dashboard KPIs |
| GET / POST | `/api/admin/books` | List or add books |
| PUT / DELETE | `/api/admin/books/:id` | Update or delete a book |
| GET | `/api/admin/borrow-records` | All borrow records |
| POST | `/api/admin/borrow-records/:borrowID/approve` | Approve (due date set to 14 days later) |
| POST | `/api/admin/borrow-records/:borrowID/reject` | Reject and return copies to stock |
| POST | `/api/admin/borrow-records/:borrowID/return` | Process a return and calculate any fine |
| POST | `/api/admin/borrow-records/:borrowID/waive-fine` | Waive a fine |
| POST | `/api/admin/borrow-records/:borrowID/pay-fine` | Record a fine payment |
| GET | `/api/admin/orders` | All orders, newest first |
| POST | `/api/admin/orders/:purchaseNo/approve` | Approve an order |
| POST | `/api/admin/orders/:purchaseNo/reject` | Reject an order and return copies to stock |
| GET | `/api/admin/book-reviews` | All book reviews |
| GET | `/api/admin/feedback` | All library feedback |

---

## Frontend Overview

| Component | Purpose |
|---|---|
| `App.jsx` | Restores the session and shows Login, Dashboard, or AdminDashboard depending on the user's role |
| `Login.jsx` | Login and Sign Up tabs |
| `Dashboard.jsx` | Member home: search, shelves, sorting, and slide-in panels (profile, borrows, orders, reviews) |
| `BookShelf.jsx` | Horizontally scrolling shelf with skeleton loading |
| `BookPage.jsx` | Book detail page with borrow, waitlist, and order actions plus a rating breakdown |
| `AdminDashboard.jsx` | Admin suite with KPI tiles and management tabs |
| `AccountDeletionDialog.jsx` | Asks for the password before deleting an account |
| `PasswordChangeForm.jsx` | Reusable password change form |
| `utils/bookSorting.js` | Sort options: `price-asc`, `price-desc`, `popularity`, `rating` |

---

## Design Decisions

- **Separate stock pools:** borrow copies and order (sale) copies are counted separately, so borrowing demand can't use up sales stock and vice versa.
- **Waitlist lifecycle:** when no borrow copies are left, a member can join the waitlist (`WAITLISTED`, `borrowDate = NULL`). When copies come back, waitlisted members see an "Available Borrow" option.
- **Popularity computed in the database:** PostgreSQL ranks popular books with aggregations and `LIMIT`.
- **Transactions with row locks:** every stock change runs inside a transaction to avoid race conditions.
- **Migrations on startup:** the schema and column migrations run automatically when the server boots.
- **Server-side logout:** logged-out JWTs are added to a database blacklist.

---

## Authors

- **Wasee**
- **Nira**

Built as a CSE216 Database Sessional project.