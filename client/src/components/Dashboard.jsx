import { useEffect, useState, useRef, useCallback } from "react";
import "./Dashboard.css";
import iconBookOpen from "../assets/book-open.svg";
import iconBookmarkCheck from "../assets/bookmark-check.svg";
import iconStar from "../assets/star.svg";
import BookShelf from "./BookShelf";
import BookPage from "./BookPage";
import AccountDeletionDialog from "./AccountDeletionDialog";

const SEARCH_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "bookID", label: "Book ID" },
  { value: "genre", label: "Genre" },
  { value: "author", label: "Author" },
  { value: "publisher", label: "Publisher" },
];

const WISHLIST_LISTS = [
  { key: "CURRENTLY_READING", label: "Currently Reading", icon: iconBookOpen },
  { key: "WANT_TO_READ", label: "Want to Read", icon: iconBookmarkCheck },
  { key: "FAVORITES", label: "Favorites", icon: iconStar },
];

// Generate a pastel colour from a string (for book cover placeholders)
function colorFromString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 62%)`;
}

function BookReviewForm({ target, draft, setDraft, onSubmit, onCancel, message }) {
  return (
    <form className="lib-book-review-form" onSubmit={onSubmit}>
      <div className="lib-book-review-heading">
        <div>
          <span>Reviewing</span>
          <strong>{target.title}</strong>
        </div>
        <button type="button" className="lib-close-btn" onClick={onCancel} aria-label="Close review form">✕</button>
      </div>
      <label>
        Rating
        <select value={draft.rating} onChange={(e) => setDraft((current) => ({ ...current, rating: Number(e.target.value) }))}>
          {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
        </select>
      </label>
      <label>
        Written review
        <textarea value={draft.comment} onChange={(e) => setDraft((current) => ({ ...current, comment: e.target.value }))} placeholder="Share what you thought about this book..." required />
      </label>
      {message && <p className="lib-review-message" role="status">{message}</p>}
      <div className="lib-book-review-actions">
        <button type="button" className="lib-secondary-action" onClick={onCancel}>Cancel</button>
        <button type="submit" className="lib-primary-action">Submit review</button>
      </div>
    </form>
  );
}

export default function Dashboard({ user, onLogout, onAccountDeleted }) {
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
  const [wishlist, setWishlist] = useState([]);

  // ── library review form ───────────────────────────────────────
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReviewData, setNewReviewData] = useState({ rating: 5, reportDetails: "" });
  const [reviewMsg, setReviewMsg] = useState("");
  const [bookReviewTarget, setBookReviewTarget] = useState(null);
  const [bookReviewDraft, setBookReviewDraft] = useState({ rating: 5, comment: "" });
  const [newBookReviewData, setNewBookReviewData] = useState({ bookID: "", rating: 5, comment: "" });
  const [bookReviewMsg, setBookReviewMsg] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const drawerRef = useRef(null);

  // Fetch user-specific data
  useEffect(() => {
    if (!user?.userID) return;
    const base = `/api/users/${user.userID}`;
    const token = sessionStorage.getItem('library_token');
    const authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};
    Promise.all([
      fetch(`${base}/borrow-records`, { headers: authHeaders }),
      fetch(`${base}/book-reviews`, { headers: authHeaders }),
      fetch(`${base}/orders`, { headers: authHeaders }),
      fetch(`${base}/library-reviews`, { headers: authHeaders }),
      fetch(`${base}/wishlist`, { headers: authHeaders }),
    ]).then(async ([bRes, rRes, oRes, lRes, wRes]) => {
      setBorrowRecords(bRes.ok ? await bRes.json() : []);
      setBookReviews(rRes.ok ? await rRes.json() : []);
      setOrderInfo(oRes.ok ? await oRes.json() : []);
      setLibraryReviewList(lRes.ok ? await lRes.json() : []);
      setWishlist(wRes.ok ? await wRes.json() : []);
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
    setSelectedBook(null);
    setSelectedBookId(null);
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
    setSelectedBook(null);
    setSelectedBookId(null);
    setActiveSection(null);
    setDrawerOpen(false);
  };

  const handleClear = () => {
    goHome();
  };

  const handleBorrow = async (book) => {
    const activeRecord = borrowRecords.find(
      (record) => String(record.bookID) === String(book.bookID)
        && ["PENDING", "BORROWED", "OVERDUE"].includes(record.status)
    );
    if (activeRecord) {
      if (activeRecord.status === "PENDING") {
        throw new Error("You already have a pending borrow request for this book.");
      }
      throw new Error("You already have this book borrowed.");
    }

    const token = sessionStorage.getItem('library_token');
    const response = await fetch(`/api/users/${user.userID}/borrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({ bookID: book.bookID }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not borrow this book.');
    setSelectedBook((current) => current ? { ...current, availableBorrowCopies: Math.max(0, Number(current.availableBorrowCopies || 0) - 1) } : current);
    setBooks((current) => current.map((b) => String(b.bookID) === String(book.bookID) ? { ...b, availableBorrowCopies: Math.max(0, Number(b.availableBorrowCopies || 0) - 1) } : b));
    setBorrowRecords((current) => [
      { ...data.record, bookName: book.title },
      ...current,
    ]);
    window.alert(`Borrow request placed for "${book.title}". Waiting for admin approval.`);
  };

  const handleOrder = async (book) => {
    const token = sessionStorage.getItem('library_token');
    const response = await fetch(`/api/users/${user.userID}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ bookID: book.bookID, quantity: 1 }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not place this order.');
    setSelectedBook((current) => current ? { ...current, availableOrderCopies: Math.max(0, Number(current.availableOrderCopies || 0) - 1) } : current);
    setBooks((current) => current.map((b) => String(b.bookID) === String(book.bookID) ? { ...b, availableOrderCopies: Math.max(0, Number(b.availableOrderCopies || 0) - 1) } : b));
    setOrderInfo((current) => [{ ...data.order, book_name: book.title, author_name: book.authorName, publisher_name: book.publisher }, ...current]);
    window.alert('Order placed. It is waiting for admin confirmation.');
  };

  const handleAddToWishlist = async (book, listType) => {
    const token = sessionStorage.getItem('library_token');
    const response = await fetch(`/api/users/${user.userID}/wishlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({ bookID: book.bookID, listType }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not add this book to your list.');
    if (!data.alreadyExists && data.entry) {
      setWishlist((current) => [
        { ...book, ...data.entry, bookID: book.bookID },
        ...current,
      ]);
    }
  };

  const handleRemoveFromWishlist = async (bookID, listType) => {
    const token = sessionStorage.getItem('library_token');
    const response = await fetch(
      `/api/users/${user.userID}/wishlist/${bookID}?listType=${encodeURIComponent(listType)}`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not remove this book from your list.');
    setWishlist((current) => current.filter(
      (entry) => !(String(entry.bookID) === String(bookID) && entry.listType === listType)
    ));
  };

  const handleMoveInWishlist = async (bookID, fromList, toList) => {
    const token = sessionStorage.getItem('library_token');
    const response = await fetch(`/api/users/${user.userID}/wishlist/${bookID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({ fromList, toList }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not move this book.');
    setWishlist((current) => current.map((entry) => (
      String(entry.bookID) === String(bookID) && entry.listType === fromList
        ? { ...entry, ...data.entry, listType: toList }
        : entry
    )));
  };

  const handleSelectBook = (bookOrId) => {
    const id = typeof bookOrId === "object" && bookOrId !== null ? bookOrId.bookID : bookOrId;
    if (typeof bookOrId === "object" && bookOrId !== null) {
      setSelectedBook(bookOrId);
    } else {
      setSelectedBook(null);
    }
    setSelectedBookId(id);
    setHasSearched(false);
    setActiveSection(null);
    const bookUrl = `/book/${id}`;
    if (window.location.pathname !== bookUrl) {
      window.history.pushState({ type: "book", id }, "", bookUrl);
    }
  };

  const handleReviewBook = (book) => {
    const hasBorrowedBook = borrowRecords.some(
      (record) => String(record.bookID) === String(book.bookID)
        && ["BORROWED", "OVERDUE", "RETURNED", "LOST"].includes(record.status)
    );

    if (window.location.pathname.startsWith("/book/")) {
      window.history.pushState({ type: "home" }, "", "/");
    }
    setSelectedBook(null);
    setSelectedBookId(null);
    setHasSearched(false);
    setBookReviewMsg(hasBorrowedBook ? "" : "Borrow this book before submitting a review.");
    setNewBookReviewData((current) => ({
      ...current,
      bookID: hasBorrowedBook ? String(book.bookID) : "",
    }));
    setActiveSection("book_review");
  };

  const handleBackFromBook = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goHome();
    }
  };

  // ── Sync with browser route / back & forward buttons ───────────
  useEffect(() => {
    const handleLocationChange = () => {
      const pathname = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const field = params.get("field");
      const keyword = params.get("keyword");

      if (pathname.startsWith("/book/")) {
        const id = pathname.replace("/book/", "").trim();
        if (id) {
          setSelectedBookId(id);
          setHasSearched(false);
          setActiveSection(null);
          return;
        }
      }

      setSelectedBookId(null);
      setSelectedBook(null);

      if (pathname.startsWith("/search") && keyword) {
        const validField = SEARCH_OPTIONS.some((o) => o.value === field) ? field : "title";
        setSearchField(validField);
        setSearchValue(keyword);
        executeSearch(validField, keyword, false);
      } else if (pathname === "/" || !keyword) {
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
      const token = sessionStorage.getItem('library_token');
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

  const openBookReview = (bookID, title) => {
    setBookReviewTarget({ bookID, title });
    setBookReviewDraft({ rating: 5, comment: "" });
    setReviewMsg("");
  };

  const submitBookReview = async (e) => {
    e.preventDefault();
    if (!bookReviewTarget || !bookReviewDraft.comment.trim()) return;
    try {
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/users/${user.userID}/book-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          bookID: Number(bookReviewTarget.bookID),
          rating: Number(bookReviewDraft.rating),
          comment: bookReviewDraft.comment.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to submit review.');
      setBookReviews((current) => [{ ...data.review, book_name: bookReviewTarget.title }, ...current]);
      setBookReviewTarget(null);
      setReviewMsg('Book review submitted.');
    } catch (error) {
      setReviewMsg(error.message);
    }
  };

  const handleBookReviewSubmit = async (e) => {
    e.preventDefault();
    const comment = newBookReviewData.comment.trim();

    if (!newBookReviewData.bookID || !comment) {
      setBookReviewMsg("Choose a borrowed book and write a review first.");
      return;
    }

    try {
      const token = sessionStorage.getItem("library_token");
      const response = await fetch(`/api/users/${user.userID}/book-reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({
          bookID: Number(newBookReviewData.bookID),
          rating: Number(newBookReviewData.rating),
          comment,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not submit book review.");
      }

      const book = borrowRecords.find(
        (record) => String(record.bookID) === String(newBookReviewData.bookID)
      );
      setBookReviews((current) => [
        { ...data.review, book_name: book?.bookName || book?.bookID },
        ...current,
      ]);
      setNewBookReviewData({ bookID: "", rating: 5, comment: "" });
      setBookReviewMsg("Review submitted!");
    } catch (error) {
      setBookReviewMsg(error.message || "Could not submit book review.");
    }
  };

  // ── nav menu items ────────────────────────────────────────────
  const menuItems = [
    { key: "user_info", label: "User Information" },
    { key: "borrow_record", label: "Borrow Records" },
    { key: "book_review", label: "Book Reviews" },
    { key: "order_info", label: "Order Info" },
    { key: "wishlist", label: "Wishlist" },
    { key: "library_review", label: "Feedback" },
  ];

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : "—";
  const hasReviewedBook = (bookID) => bookReviews.some((review) => String(review.book_id) === String(bookID));
  const borrowedBookOptions = Array.from(
    new Map(
      borrowRecords
        .filter((record) => ["BORROWED", "OVERDUE", "RETURNED", "LOST"].includes(record.status))
        .map((record) => [String(record.bookID), {
          bookID: record.bookID,
          bookName: record.bookName || `Book #${record.bookID}`,
        }])
    ).values()
  );

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
              <div>
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
                <div className="account-danger-zone">
                  <div>
                    <h4>Delete account</h4>
                    <p>Your history stays with the library, but your personal account data is removed.</p>
                  </div>
                  <button type="button" onClick={() => setDeleteDialogOpen(true)}>
                    Delete account
                  </button>
                </div>
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
                          <td>{r.status === "PENDING" ? "Upon approval" : formatDate(r.dueDate)}</td>
                          <td>{r.returnDate ? formatDate(r.returnDate) : "—"}</td>
                          <td>TK {Number(r.delayFee || 0).toFixed(0)}</td>
                          <td><span className={`status-chip status-${(r.status || "").toLowerCase()}`}>{r.status === "PENDING" ? "Pending Admin Approval" : r.status === "FINE_DUE" ? "Fine due" : r.status === "RETURNED_WITH_FINE" ? "Returned with fine" : r.status === "FINE_WAIVED" ? "Fine waved" : r.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Book Reviews */}
            {activeSection === "book_review" && (
              <div>
                <div className="lib-review-bar">
                  <span className="lib-review-msg" aria-live="polite">{bookReviewMsg}</span>
                </div>
                <form className="lib-review-form" onSubmit={handleBookReviewSubmit}>
                  <div className="form-group">
                    <label htmlFor="book-review-book">Book</label>
                    <select
                      id="book-review-book"
                      value={newBookReviewData.bookID}
                      onChange={(e) => setNewBookReviewData((current) => ({ ...current, bookID: e.target.value }))}
                      className="form-control"
                      required
                    >
                      <option value="">Choose a borrowed book</option>
                      {borrowedBookOptions.map((book) => (
                        <option key={book.bookID} value={book.bookID}>{book.bookName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="book-review-rating">Rating</label>
                    <select
                      id="book-review-rating"
                      value={newBookReviewData.rating}
                      onChange={(e) => setNewBookReviewData((current) => ({ ...current, rating: e.target.value }))}
                      className="form-control"
                    >
                      <option value={5}>5 — Excellent</option>
                      <option value={4}>4 — Good</option>
                      <option value={3}>3 — Average</option>
                      <option value={2}>2 — Poor</option>
                      <option value={1}>1 — Very poor</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="book-review-comment">Your Review</label>
                    <textarea
                      id="book-review-comment"
                      rows={4}
                      value={newBookReviewData.comment}
                      onChange={(e) => setNewBookReviewData((current) => ({ ...current, comment: e.target.value }))}
                      className="form-control"
                      placeholder="What stayed with you?"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!borrowedBookOptions.length}>
                    Submit Book Review
                  </button>
                </form>
                {bookReviews.length === 0 ? (
                  <div className="lib-empty">No book reviews yet.</div>
                ) : (
                  <div className="lib-table-wrap">
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
                  </div>
                )}
              </div>
            )}

            {/* Orders */}
            {activeSection === "order_info" && (
              <div className="lib-table-wrap">
                {bookReviewTarget && <BookReviewForm target={bookReviewTarget} draft={bookReviewDraft} setDraft={setBookReviewDraft} onSubmit={submitBookReview} onCancel={() => setBookReviewTarget(null)} message={reviewMsg} />}
                {orderInfo.length === 0 ? (
                  <div className="lib-empty">No orders found.</div>
                ) : (
                  <table className="lib-table">
                    <thead>
                      <tr><th>#</th><th>Book</th><th>Author</th><th>Publisher</th><th>Date</th><th>Price</th><th>Status</th><th>Review</th></tr>
                    </thead>
                    <tbody>
                      {orderInfo.map((o) => (
                        <tr key={o.purchaseNo}>
                          <td>{o.purchaseNo}</td>
                          <td>{o.book_name}</td>
                          <td>{o.author_name || "—"}</td>
                          <td>{o.publisher_name || "—"}</td>
                          <td>{formatDate(o.orderedAt || o.ordered_at || o.orderDate)}</td>
                          <td>TK {Number(o.price || 0).toFixed(0)}</td>
                          <td>
                            <span className={`status-chip status-${(o.status || "pending").toLowerCase()}`}>
                              {o.status === "PENDING" ? "Pending Admin Approval" : o.status === "REJECTED" ? "Rejected" : "Approved"}
                            </span>
                          </td>
                          <td>{o.status === "REJECTED" ? <span className="lib-review-pending">Order rejected</span> : o.status !== "APPROVED" ? <span className="lib-review-pending">Available after approval</span> : hasReviewedBook(o.book_id) ? <span className="lib-review-done">Reviewed</span> : <button type="button" className="lib-review-action" onClick={() => openBookReview(o.book_id, o.book_name)}>Review</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Wishlist */}
            {activeSection === "wishlist" && (
              <div className="lib-wishlist">
                <div className="lib-wishlist-intro">
                  <span className="lib-wishlist-kicker">Your reading life</span>
                  <p>Keep a quiet shelf for the books you are reading, saving, and loving.</p>
                </div>
                {WISHLIST_LISTS.map(({ key, label, icon }) => {
                  const entries = wishlist.filter((entry) => entry.listType === key);
                  return (
                    <section key={key} className="lib-wishlist-section">
                      <div className="lib-wishlist-section-heading">
                        <div>
                          <img className="lib-wishlist-section-icon" src={icon} alt="" aria-hidden="true" />
                          <h3>{label}</h3>
                        </div>
                        <span className="lib-wishlist-count">{entries.length}</span>
                      </div>
                      {entries.length === 0 ? (
                        <div className="lib-wishlist-empty">Nothing here yet.</div>
                      ) : (
                        <div className="lib-wishlist-grid">
                          {entries.map((entry) => {
                            const coverUrl = entry.ISBN
                              ? `https://covers.openlibrary.org/b/isbn/${entry.ISBN}-M.jpg`
                              : null;
                            return (
                              <article key={entry.wishlistID} className="lib-wishlist-card">
                                <div
                                  className="lib-wishlist-cover"
                                  style={{ backgroundColor: colorFromString(entry.title) }}
                                >
                                  {coverUrl && (
                                    <img
                                      src={coverUrl}
                                      alt=""
                                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                    />
                                  )}
                                  <span>{entry.title}</span>
                                </div>
                                <div className="lib-wishlist-card-body">
                                  <h4 title={entry.title}>{entry.title}</h4>
                                  <p>{entry.authorName || "Unknown author"}</p>
                                  <span className="lib-wishlist-genre">{entry.genre || "General"}</span>
                                  <div className="lib-wishlist-actions">
                                    <button type="button" onClick={() => handleSelectBook(entry)}>View</button>
                                    <select
                                      value=""
                                      aria-label={`Move ${entry.title} to another list`}
                                      onChange={async (event) => {
                                        if (!event.target.value) return;
                                        try {
                                          await handleMoveInWishlist(entry.bookID, key, event.target.value);
                                        } catch (error) {
                                          window.alert(error.message);
                                        }
                                      }}
                                    >
                                      <option value="">Move to…</option>
                                      {WISHLIST_LISTS.filter((list) => list.key !== key).map((list) => (
                                      <option key={list.key} value={list.key}>{list.label}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="lib-wishlist-remove"
                                      onClick={async () => {
                                        try {
                                          await handleRemoveFromWishlist(entry.bookID, key);
                                        } catch (error) {
                                          window.alert(error.message);
                                        }
                                      }}
                                    >
                                      ✕ Remove
                                    </button>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {/* Feedback */}
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
                  <div className="lib-empty">No feedback yet.</div>
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

      <AccountDeletionDialog
        user={user}
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDeleted={onAccountDeleted}
      />

      {/* ── MAIN CONTENT ── */}
      <main className="lib-main">
        {selectedBookId ? (
          <BookPage
            book={selectedBook}
            bookId={selectedBookId}
            onBack={handleBackFromBook}
            onBorrow={handleBorrow}
            onOrder={handleOrder}
            onReview={handleReviewBook}
            onAddToWishlist={handleAddToWishlist}
            wishlist={wishlist}
            borrowRecords={borrowRecords}
            orders={orderInfo}
          />
        ) : !hasSearched ? (
          <div className="lib-hero">
            <div className="lib-hero-text">
              <h1>Welcome to the Library</h1>
              <p>Use the search bar above to find books by title, author, genre, publisher, or ID.</p>
            </div>
            <div className="lib-shelves">
              <BookShelf genre="Thriller" label="Thrillers" onBookClick={handleSelectBook} />
              <BookShelf genre="Classic Literature" label="Classic Literature" onBookClick={handleSelectBook} />
              <BookShelf genre="Science Fiction" label="Science Fiction" onBookClick={handleSelectBook} />
              <BookShelf genre="Mystery" label="Mystery" onBookClick={handleSelectBook} />
              <BookShelf genre="Fantasy" label="Fantasy" onBookClick={handleSelectBook} />
              <BookShelf genre="Romance" label="Romance" onBookClick={handleSelectBook} />
              <BookShelf genre="History" label="History" onBookClick={handleSelectBook} />
              <BookShelf genre="Biography" label="Biography" onBookClick={handleSelectBook} />
              <BookShelf genre="Mathematics" label="Mathematics" onBookClick={handleSelectBook} />
              <BookShelf genre="Science" label="Science" onBookClick={handleSelectBook} />
              <BookShelf genre="CSE" label="CSE" onBookClick={handleSelectBook} />
              <BookShelf genre="Algorithms" label="Algorithms" onBookClick={handleSelectBook} />
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
                    onClick={() => handleSelectBook(book)}
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
                        <p className="lib-book-price">TK {Number(book.price).toFixed(0)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
