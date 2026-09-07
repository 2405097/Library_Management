import { useEffect, useState, useRef, useCallback } from "react";
import "./Dashboard.css";
import iconBookOpen from "../assets/book-open.svg";
import BookShelf from "./BookShelf";
import BookDetailModal from "./BookDetailModal";

const SEARCH_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "bookID", label: "Book ID" },
  { value: "genre", label: "Genre" },
  { value: "author", label: "Author" },
  { value: "publisher", label: "Publisher" },
];

// Generate a pastel colour from a string (for book cover placeholders)
function colorFromString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 62%)`;
}

export default function Dashboard({ user, onLogout }) {
  // ── search state ──────────────────────────────────────────────
  const [searchField, setSearchField] = useState("title");
  const [searchValue, setSearchValue] = useState("");
  const [books, setBooks] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ── hamburger / drawer state ──────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // null | 'user_info' | 'borrow_record' | ...

  // ── section data ──────────────────────────────────────────────
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [bookReviews, setBookReviews] = useState([]);
  const [orderInfo, setOrderInfo] = useState([]);
  const [libraryReviewList, setLibraryReviewList] = useState([]);

  // ── library review form ───────────────────────────────────────
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReviewData, setNewReviewData] = useState({ rating: 5, reportDetails: "" });
  const [reviewMsg, setReviewMsg] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);

  const drawerRef = useRef(null);

  // Fetch user-specific data
  useEffect(() => {
    if (!user?.userID) return;
    const base = `/api/users/${user.userID}`;
    const token = localStorage.getItem('library_token');
    const authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};
    Promise.all([
      fetch(`${base}/borrow-records`, { headers: authHeaders }),
      fetch(`${base}/book-reviews`, { headers: authHeaders }),
      fetch(`${base}/orders`, { headers: authHeaders }),
      fetch(`${base}/library-reviews`, { headers: authHeaders }),
    ]).then(async ([bRes, rRes, oRes, lRes]) => {
      setBorrowRecords(bRes.ok ? await bRes.json() : []);
      setBookReviews(rRes.ok ? await rRes.json() : []);
      setOrderInfo(oRes.ok ? await oRes.json() : []);
      setLibraryReviewList(lRes.ok ? await lRes.json() : []);
    }).catch(() => {});
  }, [user]);

  // Close drawer on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (drawerOpen && drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [drawerOpen]);

  const executeSearch = useCallback(async (field, keyword, updateHistory = true) => {
    const query = keyword.trim();
    if (!query) return;

    if (updateHistory) {
      const searchUrl = `/search?field=${encodeURIComponent(field)}&keyword=${encodeURIComponent(query)}`;
      if (window.location.pathname + window.location.search !== searchUrl) {
        window.history.pushState({ type: "search", field, query }, "", searchUrl);
      }
    }

    setIsSearching(true);
    setHasSearched(true);
    setActiveSection(null);
    try {
      const res = await fetch(
        `/api/books/search?field=${encodeURIComponent(field)}&keyword=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        setBooks(Array.isArray(data) ? data : []);
      } else {
        setBooks([]);
      }
    } catch {
      setBooks([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    executeSearch(searchField, searchValue, true);
  };

  const goHome = (e) => {
    if (e) e.preventDefault();
    if (window.location.pathname !== "/" || window.location.search !== "") {
      window.history.pushState({ type: "home" }, "", "/");
    }
    setSearchValue("");
    setBooks([]);
    setHasSearched(false);
    setActiveSection(null);
    setDrawerOpen(false);
  };

  const handleClear = () => {
    goHome();
  };

  // ── Sync with browser route / back & forward buttons ───────────
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      const field = params.get("field");
      const keyword = params.get("keyword");

      if (window.location.pathname.startsWith("/search") && keyword) {
        const validField = SEARCH_OPTIONS.some((o) => o.value === field) ? field : "title";
        setSearchField(validField);
        setSearchValue(keyword);
        executeSearch(validField, keyword, false);
      } else if (window.location.pathname === "/" || !keyword) {
        setHasSearched(false);
        setSearchValue("");
        setBooks([]);
      }
    };

    handleLocationChange();
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, [executeSearch]);

  const openSection = (key) => {
    setActiveSection(key);
    setDrawerOpen(false);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!newReviewData.reportDetails.trim()) return;
    try {
      const token = localStorage.getItem('library_token');
      const res = await fetch(`/api/users/${user.userID}/library-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          rating: Number(newReviewData.rating),
          reportDetails: newReviewData.reportDetails.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const entry = data.review || {
          libReviewID: Date.now(),
          rating: Number(newReviewData.rating),
          reportDetails: newReviewData.reportDetails.trim(),
          createdAt: new Date().toISOString(),
        };
        setLibraryReviewList((prev) => [entry, ...prev]);
        setReviewMsg("Review submitted!");
      } else {
        setReviewMsg("Failed to submit review.");
      }
    } catch {
      setReviewMsg("Network error.");
    }
    setNewReviewData({ rating: 5, reportDetails: "" });
    setShowReviewForm(false);
    setTimeout(() => setReviewMsg(""), 3000);
  };

  // ── nav menu items ────────────────────────────────────────────
  const menuItems = [
    { key: "user_info", label: "User Information" },
    { key: "borrow_record", label: "Borrow Records" },
    { key: "book_review", label: "Book Reviews" },
    { key: "order_info", label: "Order Info" },
    { key: "library_review", label: "Library Reviews" },
  ];

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="lib-root">
      {/* ── NAVBAR ── */}
      <nav className="lib-nav">
        <div className="lib-nav-left">
          <a
            href="/"
            className="lib-logo"
            onClick={goHome}
            title="LibraryMS - Return to Home"
          >
            <img src={iconBookOpen} alt="" className="lib-logo-icon" aria-hidden="true" />
            <span className="lib-logo-text">Library<strong>MS</strong></span>
          </a>

          {/* Search bar */}
          <form className="lib-search-form" onSubmit={handleSearch}>
            <div className="lib-search-field-wrap">
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="lib-search-select"
                aria-label="Search field"
              >
                {SEARCH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="lib-search-input-wrap">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search books…"
                className="lib-search-input"
                aria-label="Search books"
              />
              {searchValue && (
                <button type="button" className="lib-search-clear" onClick={handleClear} aria-label="Clear">✕</button>
              )}
            </div>
            <button type="submit" className="lib-search-btn" disabled={isSearching} aria-label="Search">
              {isSearching ? "…" : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              )}
            </button>
          </form>
        </div>

        <div className="lib-nav-right">
          <span className="lib-nav-username">{user.name}</span>
          <div className="lib-hamburger-wrap" ref={drawerRef}>
            <button
              className="lib-hamburger"
              onClick={() => setDrawerOpen((p) => !p)}
              aria-label="Menu"
              aria-expanded={drawerOpen}
            >
              <span />
              <span />
              <span />
            </button>
            {drawerOpen && (
              <div className="lib-dropdown">
                <div className="lib-dropdown-header">
                  <strong>{user.name}</strong>
                  <span className="badge-role-sm">{user.role}</span>
                </div>
                <hr className="lib-dropdown-divider" />
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    className="lib-dropdown-item"
                    onClick={() => openSection(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
                <hr className="lib-dropdown-divider" />
                <button className="lib-dropdown-item lib-signout" onClick={onLogout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── SLIDE-IN SECTION PANEL ── */}
      {activeSection && (
        <div className="lib-section-overlay" onClick={() => setActiveSection(null)}>
          <div className="lib-section-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lib-section-panel-header">
              <h2>{menuItems.find((m) => m.key === activeSection)?.label}</h2>
              <button className="lib-close-btn" onClick={() => setActiveSection(null)}>✕</button>
            </div>

            {/* User Info */}
            {activeSection === "user_info" && (
              <div className="lib-info-grid">
                {[
                  ["User ID", `#${user.userID}`],
                  ["Name", user.name],
                  ["Email", user.email],
                  ["Phone", user.phone || "—"],
                  ["Address", user.address || "—"],
                  ["Role", user.role || "MEMBER"],
                  ["Member Since", formatDate(user.createdAt)],
                ].map(([label, val]) => (
                  <div key={label} className="lib-info-card">
                    <span>{label}</span>
                    <strong>{val}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* Borrow Records */}
            {activeSection === "borrow_record" && (
              <div className="lib-table-wrap">
                {borrowRecords.length === 0 ? (
                  <div className="lib-empty">No borrow records found.</div>
                ) : (
                  <table className="lib-table">
                    <thead>
                      <tr>
                        <th>ID</th><th>Book</th><th>Borrow Date</th>
                        <th>Due Date</th><th>Return Date</th><th>Delay Fee</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borrowRecords.map((r) => (
                        <tr key={r.borrowID}>
                          <td>{r.borrowID}</td>
                          <td>{r.bookName || r.bookID}</td>
                          <td>{formatDate(r.borrowDate)}</td>
                          <td>{formatDate(r.dueDate)}</td>
                          <td>{r.returnDate ? formatDate(r.returnDate) : "—"}</td>
                          <td>${Number(r.delayFee || 0).toFixed(2)}</td>
                          <td><span className={`status-chip status-${(r.status || "").toLowerCase()}`}>{r.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Book Reviews */}
            {activeSection === "book_review" && (
              <div className="lib-table-wrap">
                {bookReviews.length === 0 ? (
                  <div className="lib-empty">No book reviews yet.</div>
                ) : (
                  <table className="lib-table">
                    <thead>
                      <tr><th>Book</th><th>Rating</th><th>Comment</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {bookReviews.map((r) => (
                        <tr key={r.reviewID}>
                          <td>{r.book_name || r.book_id}</td>
                          <td>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</td>
                          <td>{r.comment || "—"}</td>
                          <td>{formatDate(r.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Orders */}
            {activeSection === "order_info" && (
              <div className="lib-table-wrap">
                {orderInfo.length === 0 ? (
                  <div className="lib-empty">No orders found.</div>
                ) : (
                  <table className="lib-table">
                    <thead>
                      <tr><th>#</th><th>Book</th><th>Author</th><th>Publisher</th><th>Date</th><th>Price</th></tr>
                    </thead>
                    <tbody>
                      {orderInfo.map((o) => (
                        <tr key={o.purchaseNo}>
                          <td>{o.purchaseNo}</td>
                          <td>{o.book_name}</td>
                          <td>{o.author_name || "—"}</td>
                          <td>{o.publisher_name || "—"}</td>
                          <td>{formatDate(o.orderDate)}</td>
                          <td>${Number(o.price || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Library Reviews */}
            {activeSection === "library_review" && (
              <div>
                <div className="lib-review-bar">
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowReviewForm((p) => !p)}
                  >
                    {showReviewForm ? "Close Form" : "Write a Review"}
                  </button>
                  {reviewMsg && <span className="lib-review-msg">{reviewMsg}</span>}
                </div>
                {showReviewForm && (
                  <form className="lib-review-form" onSubmit={handleReviewSubmit}>
                    <div className="form-group">
                      <label>Rating</label>
                      <select
                        value={newReviewData.rating}
                        onChange={(e) => setNewReviewData((p) => ({ ...p, rating: e.target.value }))}
                        className="form-control"
                      >
                        <option value={5}>5 — Excellent</option>
                        <option value={4}>4 — Good</option>
                        <option value={3}>3 — Average</option>
                        <option value={2}>2 — Poor</option>
                        <option value={1}>1 — Very Poor</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Your Review</label>
                      <textarea
                        rows={4}
                        value={newReviewData.reportDetails}
                        onChange={(e) => setNewReviewData((p) => ({ ...p, reportDetails: e.target.value }))}
                        className="form-control"
                        placeholder="Share your experience with the library…"
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">Submit Review</button>
                  </form>
                )}
                {libraryReviewList.length === 0 ? (
                  <div className="lib-empty">No library reviews yet.</div>
                ) : (
                  <div className="lib-review-list">
                    {libraryReviewList.map((r) => (
                      <div key={r.libReviewID} className="lib-review-card">
                        <div className="lib-review-card-top">
                          <span className="lib-stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                          <span className="lib-review-date">{formatDate(r.createdAt)}</span>
                        </div>
                        <p>{r.reportDetails}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="lib-main">
        {!hasSearched ? (
          <div className="lib-hero">
            <div className="lib-hero-text">
              <h1>Welcome to the Library</h1>
              <p>Use the search bar above to find books by title, author, genre, publisher, or ID.</p>
            </div>
            <div className="lib-shelves">
              <BookShelf genre="Thriller" label="Thrillers" onBookClick={setSelectedBook} />
              <BookShelf genre="Classic Literature" label="Classic Literature" onBookClick={setSelectedBook} />
              <BookShelf genre="Science Fiction" label="Science Fiction" onBookClick={setSelectedBook} />
              <BookShelf genre="Mystery" label="Mystery" onBookClick={setSelectedBook} />
              <BookShelf genre="Fantasy" label="Fantasy" onBookClick={setSelectedBook} />
              <BookShelf genre="Romance" label="Romance" onBookClick={setSelectedBook} />
              <BookShelf genre="History" label="History" onBookClick={setSelectedBook} />
              <BookShelf genre="Biography" label="Biography" onBookClick={setSelectedBook} />
            </div>
          </div>
        ) : (
          <div className="lib-results-section">
            <div className="lib-results-header">
              <h2>
                {isSearching
                  ? "Searching…"
                  : `${books.length} result${books.length !== 1 ? "s" : ""} for "${searchValue}"`}
              </h2>
            </div>
            {books.length === 0 && !isSearching ? (
              <div className="lib-no-results">
                <p>No books found. Try a different search term or field.</p>
              </div>
            ) : (
              <div className="lib-book-grid">
                {books.map((book) => (
                  <div
                    className="lib-book-card"
                    key={book.bookID}
                    onClick={() => setSelectedBook(book)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="lib-book-cover-wrapper">
                      {book.ISBN && (
                        <img
                          src={`https://covers.openlibrary.org/b/isbn/${book.ISBN}-M.jpg`}
                          alt={book.title}
                          className="lib-book-cover-img"
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = "none";
                            if (e.target.nextElementSibling) {
                              e.target.nextElementSibling.style.display = "flex";
                            }
                          }}
                        />
                      )}
                      <div
                        className="lib-book-cover"
                        style={{
                          backgroundColor: colorFromString(book.title),
                          display: book.ISBN ? "none" : "flex",
                        }}
                      >
                        <span className="lib-book-cover-title">{book.title}</span>
                      </div>
                    </div>
                    <div className="lib-book-info">
                      <h4 className="lib-book-title">{book.title}</h4>
                      <p className="lib-book-author">{book.authorName || "Unknown Author"}</p>
                      <p className="lib-book-genre">{book.genre || "—"}</p>
                      {book.price != null && (
                        <p className="lib-book-price">${Number(book.price).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── BOOK DETAIL MODAL ── */}
      <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} />
    </div>
  );
}
