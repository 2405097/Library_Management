# Library Management System — Codebase Overview

> PERN Stack | CSE216 Database Sessional Project  
> Repo: https://github.com/2405097/Library_Management  
> Authors: Wasee & Nira

---

## 1. Project Structure

```
Library_Management/
├── Backend/
│   ├── package.json               # ES module, Express 5, pg, bcryptjs, jsonwebtoken, dotenv
│   └── src/
│       ├── index.js               # Entry point — connects DB, runs migrations, starts server (:4000)
│       ├── app.js                 # Express app, CORS, JSON body, mounts all routes
│       ├── config/
│       │   ├── database.js        # pg Pool, connectDB(), initializeDatabase() (schema + migrations)
│       │   └── constants.js       # DB_NAME constant
│       ├── database/
│       │   └── schema.sql         # Full DDL & stored procedures/functions
│       ├── middleware/
│       │   └── auth.middleware.js # authenticate, authorize(...roles), authorizeSelfOrAdmin
│       ├── Routes/
│       │   ├── user.route.js      # /api/users  — auth, CRUD, borrow/waitlist/review/order/wishlist/delete
│       │   ├── book.route.js      # /api/books  — search, popular, catalog, details, reviews, related
│       │   └── admin.route.js     # /api/admin  — admin dashboard, approvals, reviews, fines & feedback
│       ├── Controllers/
│       │   └── user.controller.js # All controller functions (single file, ~720 lines)
│       ├── Models/
│       │   └── user.model.js      # All SQL queries / DB logic (single file, ~1440 lines)
│       └── scripts/
│           └── seedBooks.js       # Seeds books from Open Library API by genre (run once)
│
└── client/
    ├── package.json               # Vite + React 19, ESLint 9+
    ├── vite.config.js             # Dev server :5173, proxies /api → http://127.0.0.1:4000
    ├── index.html
    └── src/
        ├── main.jsx               # ReactDOM.createRoot
        ├── App.jsx                # Root: Login → Dashboard (MEMBER/STAFF) | AdminDashboard (ADMIN)
        ├── App.css
        ├── index.css
        └── components/
            ├── Login.jsx                  # Email/password form, posts to /api/users/login, stores JWT
            ├── Login.css                  # Shared styles for auth, admin tables & status chips
            ├── Dashboard.jsx              # Member view — search, book shelves, slide-in panels, waitlist
            ├── Dashboard.css
            ├── BookShelf.jsx              # Horizontal scrollable shelf, skeleton loading, sortable
            ├── BookShelf.css
            ├── BookPage.jsx               # Full book detail view, ratings breakdown, borrow/waitlist/order
            ├── BookPage.css
            ├── AdminDashboard.jsx         # Admin suite — KPI tiles + 9 management tabs + approval workflows
            ├── AdminDashboard.css
            ├── AccountDeletionDialog.jsx  # Re-authentication modal for self-service account deletion
            ├── AccountDeletionDialog.css
            ├── bookSorting.js             # Multi-criteria sorting helper (price, popularity, rating)
            └── assets/                    # SVG icons (book-open, bookmark-check, star, etc.)
```

---

## 2. Architecture & Data Flow

```
Browser (React)
    │
    │  /api/*  (Vite proxy :5173 → :4000 in dev)
    ▼
Express App (:4000 / :8000)
    │
    ├── Middleware: authenticate (JWT verify + revoked-token check)
    ├── Middleware: authorize('ADMIN') | authorizeSelfOrAdmin
    │
    ├── Routes → Controllers → Models → PostgreSQL (pg Pool)
    │
    └── External: Open Library API (client-side only, for covers & synopsis fallback)
```

**Auth flow:**
1. `POST /api/users/login` → verifies bcrypt hash → verifies `isApproved` (blocks unapproved signups) → issues signed JWT (7-day default).
2. Every protected request sends `Authorization: Bearer <token>` in the request headers.
3. `POST /api/users/logout` → inserts token into `revoked_token` table (server-side blacklist).
4. `authenticate` middleware checks signature + revocation on every protected route.

**Frontend session:**
- JWT stored in `sessionStorage` as `library_token`.
- User object stored in `sessionStorage` as `library_user`.
- `App.jsx` reads session state on mount and conditionally renders `<Login>`, `<Dashboard>`, or `<AdminDashboard>`.

---

## 3. Database Schema

All tables live in the default `public` schema of a PostgreSQL database.

| Table | PK | Key Columns | Notes |
|---|---|---|---|
| `USERS` | `userID` (SERIAL) | name, email, phone, address, role, isApproved, approvedAt, createdAt, avatar, bio | role ∈ {MEMBER, STAFF, ADMIN}; isApproved defaults to TRUE for existing users |
| `CREDENTIALS` | `userID` (FK→USERS) | username, passHash, lastLogin | 1:1 with USERS, CASCADE delete |
| `PUBLISHER` | `publisherID` | publisherName, address, contactInfo | |
| `AUTHOR` | `authorID` | name, biography, nationality, date_of_birth | |
| `BOOK` | `bookID` | title, genre, avg_rating, language, price, ISBN, edition, publicationYear, borrowCopies, orderCopies, totalCopies, availableBorrowCopies, availableOrderCopies, publisherID | Separate inventory counters for borrowing vs purchasing. Atomic decrement on request; restore on return or rejection |
| `BOOK_AUTHOR` | (bookID, authorID) | — | M:N bridge table |
| `BORROW_RECORD` | `borrowID` | borrowDate, requestedAt, dueDate, returnDate, delayFee, status, approvedAt, returnRequestedAt, userID, bookID | status ∈ {PENDING, BORROWED, RETURNED, OVERDUE, LOST, REJECTED, WAITLISTED, FINE_DUE, RETURNED_WITH_FINE, FINE_WAIVED}. `borrowDate` is NULL for waitlist |
| `ORDER` | `purchaseNo` | orderDate, orderedAt, price, quantity, status, approvedAt, userID, bookID | status ∈ {PENDING, APPROVED, REJECTED}; strictly tracked by `orderedAt` |
| `WISHLIST` | `wishlistID` | listType, addedAt, userID, bookID | listType ∈ {CURRENTLY_READING, WANT_TO_READ, FAVORITES}; UNIQUE(userID, bookID, listType) |
| `BOOK_REVIEW` | `reviewID` | rating (1–5), comment, createdAt, userID, bookID | Only allowed after borrowing or purchasing |
| `LIBRARY_REVIEW` | `libReviewID` | rating (1–5), reportDetails, createdAt, userID | General library feedback |
| `REVOKED_TOKEN` | `token` (TEXT) | revokedAt | JWT blacklist for server-side logout |

**Stored Procedures & Functions:**
- `fn_get_book_rating_stats(book_id)`: Calculates rating summary, average rating, total ratings, and 1–5 star distribution counts.
- `borrowBook()`: Uses transaction locks to verify `availableBorrowCopies > 0`, decrement copies atomically, and insert borrow record (`PENDING`).
- `addBorrowWaitlist()`: Inserts waitlist record with `status = 'WAITLISTED'`, `borrowDate = NULL`, and `dueDate = NULL`.
- `cancelBorrowWaitlist()`: Deletes waitlist record when a member leaves the waitlist.
- `createOrder()`: Runs within a transaction to verify `availableOrderCopies >= quantity`, decrement copies atomically, and insert order with `orderedAt` timestamp.
- `rejectOrder()` / `rejectBorrow()`: Restores reserved inventory copies and marks status as `'REJECTED'`.

---

## 4. API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| POST | `/api/users/` | Register new user (bcrypt hashes password) |
| POST | `/api/users/login` | Login → verifies approval & returns JWT + user object |
| GET | `/api/books/search?field=&keyword=` | Search books (title, bookID, genre, author, publisher) |
| GET | `/api/books/popular?limit=10` | Top popular books sorted by interest (borrow + order count) directly in PostgreSQL |
| GET | `/api/books/catalog` | Full catalog listing with calculated popularity and review metrics |
| GET | `/api/books/:id` | Detailed book metadata, rating stats, and inventory counts |
| GET | `/api/books/:id/reviews` | Reviews and star ratings for a specific book |
| GET | `/api/books/:id/related` | Related books in the same genre |

### Authenticated (Members & Staff)

| Method | Path | Middleware | Description |
|---|---|---|---|
| POST | `/api/users/logout` | authenticate | Revoke JWT |
| DELETE | `/api/users/:id/account` | authenticate | Self-delete user account (requires password re-auth) |
| GET | `/api/users/:id` | authenticate, selfOrAdmin | Get user profile |
| PUT | `/api/users/:id` | authenticate, selfOrAdmin | Update profile, bio, or credentials |
| GET | `/api/users/:id/borrow-records` | authenticate, selfOrAdmin | List borrow history and waitlisted books |
| POST | `/api/users/:id/borrow` | authenticate, selfOrAdmin | Request to borrow an available book (copies decremented → PENDING) |
| POST | `/api/users/:id/borrow-records` | authenticate, selfOrAdmin | Join borrow waitlist for an unavailable book (status → WAITLISTED) |
| DELETE | `/api/users/:id/borrow-records/:borrowID` | authenticate, selfOrAdmin | Cancel / leave borrow waitlist |
| POST | `/api/users/:id/borrow-records/:borrowID/request-return` | authenticate, selfOrAdmin | Member requests return of borrowed book |
| GET | `/api/users/:id/orders` | authenticate, selfOrAdmin | List orders (ordered by `orderedAt DESC`) |
| POST | `/api/users/:id/orders` | authenticate, selfOrAdmin | Place book purchase order (decrements order copies → PENDING) |
| GET | `/api/users/:id/wishlist` | authenticate, selfOrAdmin | List user wishlist grouped by listType |
| POST | `/api/users/:id/wishlist` | authenticate, selfOrAdmin | Add book to list (CURRENTLY_READING, WANT_TO_READ, FAVORITES) |
| DELETE | `/api/users/:id/wishlist/:bookID` | authenticate, selfOrAdmin | Remove book from wishlist |
| PATCH | `/api/users/:id/wishlist/:bookID` | authenticate, selfOrAdmin | Move book to another listType |
| GET | `/api/users/:id/book-reviews` | authenticate, selfOrAdmin | List member's book reviews |
| POST | `/api/users/:id/book-reviews` | authenticate, selfOrAdmin | Submit book review |
| GET | `/api/users/:id/library-reviews` | authenticate, selfOrAdmin | List member's library feedback |
| POST | `/api/users/:id/library-reviews` | authenticate, selfOrAdmin | Submit library review |

### Admin-only (`role = ADMIN`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/` | List all users |
| POST | `/api/admin/signup-approvals/:id/approve` | Approve a pending user registration |
| GET | `/api/admin/summary` | Dashboard KPI metrics (users, books, active borrows, pending borrows, orders, reviews) |
| GET | `/api/admin/books` | All books with author & publisher details |
| POST | `/api/admin/books` | Add new book with author, publisher, copies, and pricing |
| PUT | `/api/admin/books/:id` | Update book inventory and metadata |
| DELETE | `/api/admin/books/:id` | Remove a book from inventory |
| GET | `/api/admin/borrow-records` | All borrow records with member & book names |
| POST | `/api/admin/borrow-records/:borrowID/approve` | Approve borrow → set BORROWED, borrowDate, dueDate (+14d) |
| POST | `/api/admin/borrow-records/:borrowID/reject` | Reject borrow → restore availableBorrowCopies, set REJECTED |
| POST | `/api/admin/borrow-records/:borrowID/return` | Process return → calculate fine if overdue, restore copies |
| POST | `/api/admin/borrow-records/:borrowID/waive-fine` | Waive outstanding late return fee |
| POST | `/api/admin/borrow-records/:borrowID/pay-fine` | Record payment of late return fee |
| GET | `/api/admin/orders` | All orders strictly ordered by `orderedAt DESC, purchaseNo DESC` |
| POST | `/api/admin/orders/:purchaseNo/approve` | Approve order → set APPROVED |
| POST | `/api/admin/orders/:purchaseNo/reject` | Reject order → restore availableOrderCopies, set REJECTED |
| GET | `/api/admin/book-reviews` | All book reviews |
| GET | `/api/admin/feedback` | All library feedback |

---

## 5. Frontend Components & UI

### `App.jsx`
Root state holder. Reads `sessionStorage` on mount. Routes to `<Login>`, `<Dashboard>`, or `<AdminDashboard>` based on `currentUser.role`. Handles secure logout and account deletion events.

### `Login.jsx`
Email + password form with tabbed Login / Sign Up views. On success, stores JWT and user in `sessionStorage` and triggers `onLoginSuccess`.

### `Dashboard.jsx` (Member View)
- **Navigation & Search:** Navbar with logo, quick-search field selector (Title, Book ID, Genre, Author, Publisher), keyword search, hamburger drawer, and quick wishlist view.
- **Independent Sorting:** Separate sort controls for homepage shelves (`homeSortBy`) and search results (`searchSortBy`). Supports price ascending/descending, popularity, and rating.
- **Homepage Shelves:**
  - "Most popular books" shelf populated directly via `/api/books/popular?limit=10`.
  - 11 genre shelves (Thriller, Classic Literature, Science Fiction, Mystery, Fantasy, Romance, History, Biography, Mathematics, CSE, Algorithms) loaded on demand with skeleton states.
- **Borrow & Waitlist Management:**
  - Shows "Available Borrow" when copies become free for waitlisted items.
  - Shows active "Cancel" button allowing members to leave the waitlist at any time.
- **Slide-in Drawer Panels:** User Information (with profile bio edit & account deletion), Borrow Records (with return request & cancel waitlist), Book Reviews, Order Info, and Library Reviews.

### `BookShelf.jsx`
Horizontal scroll strip for a single genre or supplied book list. Renders skeleton cards during loading (`isLoading`). Hides cleanly if a genre has 0 books. Sorts books dynamically via `bookSorting.js`.

### `BookPage.jsx`
Full-page book detail view styled after Open Library:
- **Direct Waitlist Action:** If `availableBorrowCopies <= 0`, primary button displays an active **"Join Borrow List"** button.
- **Availability States:** Primary buttons reflect current member status: "Borrow", "Pending Admin Approval", "Currently Borrowed", "On Borrow List", "Join Borrow List", "Out of Stock".
- **Ratings & Reviews:** Visual rating breakdown bars (5 to 1 star counts), average rating score, and member reviews with write-a-review modal.
- **Open Library Enrichment:** Enriches data with cover images, synopsis fallback, publication details, and related book suggestions.

### `AdminDashboard.jsx`
Comprehensive administrative panel with balanced table layouts:
- **My Admin Information:** Header profile summary with single top-right "Edit Account" modal trigger and bottom-right self-service account deletion.
- **Member Info & Admin Info:** Tabular directory of accounts.
- **Signup Approval:** Approve pending registrations.
- **Library Info:** KPI grid displaying total catalog size, member count, active loans, and pending requests.
- **Book Info:** Full catalog inventory management (add, edit, stock levels).
- **Borrow Book Info:** Compact side-by-side Approve/Reject actions, return processing, and fine waiver/payment controls.
- **Ordered Book Info:** Purchase requests ordered strictly by timestamp descending (`orderedAt DESC, purchaseNo DESC`) with copy restoration on rejection.
- **Book Reviews & Feedback:** Review moderation and feedback inspection.

### `bookSorting.js`
Reusable sorting helper used by shelves, search results, and catalogs.
- `price-asc`: Price low-to-high, title tie-breaker.
- `price-desc`: Price high-to-low, title tie-breaker.
- `popularity`: Combined borrow + order count, rating tie-breaker.
- `rating`: Average rating score, review count tie-breaker.

### `AccountDeletionDialog.jsx`
Re-authentication modal requiring password confirmation before executing `DELETE /api/users/:id/account`.

---

## 6. Dev Setup

```bash
# Backend
cd Backend
cp .env.example .env   # set DATABASE_URL and JWT_SECRET
npm install
npm run dev            # nodemon on :4000 (or PORT env var)

# Seed books (run once after schema init)
node src/scripts/seedBooks.js        # 150 books/genre default
node src/scripts/seedBooks.js 200    # custom count

# Client
cd client
npm install
npm run dev            # Vite on :5173, proxies /api → :4000
```

**Required `.env` (Backend):**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/postgres
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
PORT=4000
```

---

## 7. Key Design Decisions & Notes

- **Separated Inventory Pools:** Books track `borrowCopies` and `orderCopies` independently (`availableBorrowCopies` and `availableOrderCopies`), preventing borrow demand from draining sales inventory and vice-versa.
- **Waitlist Lifecycle:** When borrow copies reach 0, members can join the waitlist (`WAITLISTED` status with `borrowDate = NULL`). Members can cancel their waitlist at any time. When a book is returned or inventory is added, waitlisted members receive an "Available Borrow" option.
- **Database-Level Sorting & Pagination:** Popular books (`/api/books/popular?limit=10`) are computed directly in PostgreSQL using aggregations and `LIMIT`, avoiding table scans and correlated subqueries across the entire catalog.
- **Borrow & Order Transactions:** All inventory reservations and returns execute within database transactions with concurrency locks to prevent race conditions.
- **Startup Schema Migrations:** Database tables and column modifications (e.g. `orderedAt`, `requestedAt`, `isApproved`, waitlist constraints) run automatically inside `initializeDatabase()` in `database.js` on boot.
- **Session Security & Revocation:** JWTs stored in `sessionStorage` with server-side revocation on logout through the `revoked_token` table.
