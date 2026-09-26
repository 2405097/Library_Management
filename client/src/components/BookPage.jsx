import { useEffect, useState, useMemo } from "react";
import "./BookPage.css";
import iconBookOpen from "../assets/book-open.svg";
import iconBookmarkCheck from "../assets/bookmark-check.svg";
import iconStar from "../assets/star.svg";

const WISHLIST_OPTIONS = [
  { key: "CURRENTLY_READING", label: "Currently Reading", icon: iconBookOpen },
  { key: "WANT_TO_READ", label: "Want to Read", icon: iconBookmarkCheck },
  { key: "FAVORITES", label: "Favorites", icon: iconStar },
];

function getCoverColor(str = "Book") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 45%)`;
}

export default function BookPage({
  book: initialBook,
  bookId,
  onBack,
  onBorrow,
  onJoinBorrowList,
  onOrder,
  onAddToWishlist,
  wishlist = [],
  borrowRecords = [],
  orders = [],
  onSelectBook,
}) {
  const [book, setBook] = useState(initialBook || null);
  const [reviews, setReviews] = useState([]);
  const [relatedBooks, setRelatedBooks] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [olData, setOlData] = useState(null);
  const [synopsis, setSynopsis] = useState("");
  const [synopsisLoading, setSynopsisLoading] = useState(false);
  const [loadingBook, setLoadingBook] = useState(!initialBook);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [borrowing, setBorrowing] = useState(false);
  const [joiningBorrowList, setJoiningBorrowList] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  useEffect(() => {
    if (initialBook) {
      setBook(initialBook);
    }
  }, [initialBook]);

  const effectiveBookId = bookId || initialBook?.bookID;
  const cleanIsbn = book?.ISBN ? String(book.ISBN).replace(/[^0-9X]/gi, "") : "";
  const bookListTypes = wishlist
    .filter((entry) => String(entry.bookID) === String(book?.bookID))
    .map((entry) => entry.listType);

  const pendingBorrow = (borrowRecords || []).find(
    (r) => String(r.bookID || r.book_id) === String(book?.bookID) && r.status === "PENDING"
  );
  const waitlistedBorrow = (borrowRecords || []).find(
    (r) => String(r.bookID || r.book_id) === String(book?.bookID) && r.status === "WAITLISTED"
  );
  const activeBorrow = (borrowRecords || []).find(
    (r) => String(r.bookID || r.book_id) === String(book?.bookID) && ["BORROWED", "OVERDUE"].includes(r.status)
  );
  const pendingOrder = (orders || []).find(
    (o) => String(o.bookID || o.book_id) === String(book?.bookID) && o.status === "PENDING"
  );

  // ── 1. Fetch fresh book details & user reviews from local database ────────
  useEffect(() => {
    let isMounted = true;
    if (!effectiveBookId) return;

    async function loadLocalBookAndReviews() {
      if (!initialBook) setLoadingBook(true);
      try {
        const token = sessionStorage.getItem("library_token");
        const headers = token ? { Authorization: "Bearer " + token } : {};
        const [bookRes, reviewsRes] = await Promise.all([
          fetch(`/api/books/${effectiveBookId}`, { headers }),
          fetch(`/api/books/${effectiveBookId}/reviews`, { headers }),
        ]);

        if (bookRes.ok) {
          const bookData = await bookRes.json();
          if (isMounted && bookData) {
            setBook((prev) => ({ ...(prev || {}), ...bookData }));
          }
        } else {
          // Fallback search if /:id is not supported
          const fallbackRes = await fetch(`/api/books/search?field=bookID&keyword=${effectiveBookId}`, { headers });
          if (fallbackRes.ok) {
            const list = await fallbackRes.json();
            if (isMounted && Array.isArray(list) && list.length > 0) {
              setBook((prev) => ({ ...(prev || {}), ...list[0] }));
            }
          }
        }

        if (reviewsRes.ok) {
          const revList = await reviewsRes.json();
          if (isMounted && Array.isArray(revList)) {
            setReviews(revList);
          }
        }

        // Fetch related books from local database (no external APIs)
        setLoadingRelated(true);
        const relRes = await fetch(`/api/books/${effectiveBookId}/related`);
        if (relRes.ok) {
          const relList = await relRes.json();
          if (isMounted && Array.isArray(relList)) {
            setRelatedBooks(relList);
          }
        }
      } catch (err) {
        console.warn("Could not fetch book details, reviews, or related books from backend:", err);
      } finally {
        if (isMounted) {
          setLoadingBook(false);
          setLoadingRelated(false);
        }
      }
    }

    loadLocalBookAndReviews();

    return () => {
      isMounted = false;
    };
  }, [effectiveBookId]);

  const handleRelatedBookClick = (relBook) => {
    if (onSelectBook) {
      onSelectBook(relBook);
    } else {
      setBook(relBook);
    }
    setActiveTab("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── 2. Fetch Open Library details & synopsis via OpenLibrary API only ─────
  useEffect(() => {
    if (!cleanIsbn) return;

    let isCancelled = false;

    async function fetchFromOpenLibrary() {
      setSynopsisLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      try {
        // Fetch book data (subjects, pages, publishers, notes, etc.)
        const dataUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
        const dataRes = await fetch(dataUrl, { signal: controller.signal });
        
        let loadedData = null;
        if (dataRes.ok) {
          const json = await dataRes.json();
          loadedData = json[`ISBN:${cleanIsbn}`] || null;
          if (!isCancelled && loadedData) {
            setOlData(loadedData);
          }
        }

        // Try to fetch synopsis / description from OpenLibrary
        // A: check if data has notes or description
        let foundDesc = "";
        if (loadedData?.notes) {
          foundDesc = typeof loadedData.notes === "string" ? loadedData.notes : loadedData.notes.value;
        }

        // B: If no synopsis yet, try jscmd=details
        if (!foundDesc) {
          try {
            const detailsUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=details`;
            const detailsRes = await fetch(detailsUrl, { signal: controller.signal });
            if (detailsRes.ok) {
              const detailsJson = await detailsRes.json();
              const detailsObj = detailsJson[`ISBN:${cleanIsbn}`]?.details;
              if (detailsObj?.description) {
                foundDesc =
                  typeof detailsObj.description === "string"
                    ? detailsObj.description
                    : detailsObj.description.value;
              }
            }
          } catch {
            // non-critical if details fail
          }
        }

        // C: If still no synopsis, try direct edition endpoint to check for works key
        if (!foundDesc) {
          try {
            const editionRes = await fetch(`https://openlibrary.org/isbn/${cleanIsbn}.json`, {
              signal: controller.signal,
            });
            if (editionRes.ok) {
              const editionJson = await editionRes.json();
              if (editionJson.description) {
                foundDesc =
                  typeof editionJson.description === "string"
                    ? editionJson.description
                    : editionJson.description.value;
              } else if (editionJson.works && editionJson.works.length > 0) {
                const workKey = editionJson.works[0].key;
                const workRes = await fetch(`https://openlibrary.org${workKey}.json`, {
                  signal: controller.signal,
                });
                if (workRes.ok) {
                  const workJson = await workRes.json();
                  if (workJson.description) {
                    foundDesc =
                      typeof workJson.description === "string"
                        ? workJson.description
                        : workJson.description.value;
                  }
                }
              }
            }
          } catch {
            // fallback
          }
        }

        if (!isCancelled) {
          if (foundDesc && foundDesc.trim()) {
            setSynopsis(foundDesc.trim());
          } else {
            setSynopsis(
              `"${book.title}" is a notable work in the ${book.genre || "general literature"} category. Currently, no extended synopsis has been recorded in the Open Library catalog for this edition. You may explore borrow records, publisher information, and catalog details below.`
            );
          }
        }
      } catch (err) {
        console.warn("OpenLibrary API request failed or timed out:", err);
        if (!isCancelled) {
          setSynopsis(
            `"${book.title}" is a work by ${book.authorName || "an esteemed author"}. The Open Library catalog entry could not be reached at this time, but the book is indexed in the library collection.`
          );
        }
      } finally {
        clearTimeout(timeoutId);
        if (!isCancelled) setSynopsisLoading(false);
      }
    }

    fetchFromOpenLibrary();

    return () => {
      isCancelled = true;
    };
  }, [cleanIsbn, book?.title, book?.genre, book?.authorName]);

  // Fallback title hash color if no cover
  const placeholderBg = useMemo(() => {
    const str = book?.title || "Book";
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 50%, 45%)`;
  }, [book?.title]);

  if (loadingBook) {
    return (
      <div className="book-page-wrapper">
        <div className="bp-loading-wrapper">
          <div className="bp-spinner" />
          <p>Loading book information from catalog…</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="book-page-wrapper">
        <div className="bp-error-wrapper">
          <h3>Book Not Found</h3>
          <p>We couldn't find the requested book in the library records.</p>
          <button type="button" className="bp-back-btn" onClick={onBack}>
            ← Back to Library
          </button>
        </div>
      </div>
    );
  }

  const coverUrl = book.ISBN ? `https://covers.openlibrary.org/b/isbn/${book.ISBN}-L.jpg` : null;

  // Real-time rating statistics from database
  const rawAvg = book.avgRating != null ? Number(book.avgRating) : 0.0;
  const ratingValue = rawAvg.toFixed(1);
  const ratingCount = Number(book.ratingCount != null ? book.ratingCount : reviews.length);
  const wantToReadCount = Number(book.wantToReadCount || 0);
  const currentlyReadingCount = Number(book.currentlyReadingCount || 0);
  const haveReadCount = Number(book.haveReadCount || 0);

  // Rounded stars: ★★★★☆ based on average rating
  const roundedStars = Math.min(5, Math.max(0, Math.round(rawAvg)));
  const starsDisplay = "★".repeat(roundedStars) + "☆".repeat(5 - roundedStars);

  const publishYear = book.publicationYear || olData?.publish_date || "Unknown";
  const publisherName = book.publisher || (olData?.publishers && olData.publishers[0]?.name) || "Unknown Publisher";
  const pageCount = olData?.number_of_pages || "—";
  const languageName = book.language || "English";

  // Subjects from Open Library data or fallback from genre
  const subjects = olData?.subjects?.slice(0, 6).map((s) => (typeof s === "string" ? s : s.name)) || (book.genre ? [book.genre, "Fiction", "General"] : ["General"]);
  const people = olData?.subject_people?.slice(0, 4).map((p) => (typeof p === "string" ? p : p.name)) || (book.authorName ? [book.authorName] : []);
  const places = olData?.subject_places?.slice(0, 4).map((p) => (typeof p === "string" ? p : p.name)) || [];
  const times = olData?.subject_times?.slice(0, 4).map((t) => (typeof t === "string" ? t : t.name)) || [];

  const handleBorrow = async () => {
    if (!onBorrow || borrowing) return;
    setBorrowing(true);
    try {
      await onBorrow(book);
    } catch (error) {
      window.alert(error.message || "Could not borrow this book.");
    } finally {
      setBorrowing(false);
    }
  };

  const handleJoinBorrowList = async () => {
    if (!onJoinBorrowList || joiningBorrowList || waitlistedBorrow) return;
    setJoiningBorrowList(true);
    try {
      await onJoinBorrowList(book);
    } catch (error) {
      window.alert(error.message || "Could not add this book to your borrow list.");
    } finally {
      setJoiningBorrowList(false);
    }
  };

  const handleOrder = async () => {
    if (!onOrder || ordering) return;
    setOrdering(true);
    try {
      await onOrder(book);
    } catch (error) {
      window.alert(error.message || "Could not place this order.");
    } finally {
      setOrdering(false);
    }
  };

  const handleAddToList = async (listType) => {
    if (!onAddToWishlist || addingToList || bookListTypes.includes(listType)) return;
    setAddingToList(true);
    try {
      await onAddToWishlist(book, listType);
      setShowListPicker(false);
    } catch (error) {
      window.alert(error.message || "Could not add to list.");
    } finally {
      setAddingToList(false);
    }
  };

  return (
    <div className="book-page-wrapper">
      {/* ── BREADCRUMB & BACK NAV ── */}
      <nav className="bp-top-nav" aria-label="Breadcrumb navigation">
        <button type="button" className="bp-back-btn" onClick={onBack}>
          ← Back to Library
        </button>
        <div className="bp-breadcrumbs">
          <span>Catalog</span> &rsaquo;{" "}
          <span>{book.genre || "Books"}</span> &rsaquo;{" "}
          <span className="active">{book.title}</span>
        </div>
      </nav>

      {/* ── MAIN WHITE CARD ── */}
      <div className="bp-card">
        {/* OpenLibrary Style Header Tabs */}
        <header className="bp-tabs-header">
          <ul className="bp-tabs-list" role="tablist">
            {["overview", "reviews", "related books"].map((tab) => (
              <li key={tab}>
                <button
                  type="button"
                  className={`bp-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "reviews" && ratingCount > 0 ? ` (${ratingCount})` : ""}
                </button>
              </li>
            ))}
          </ul>
          <div className="bp-tab-meta">
            <span>Last synchronized via Open Library</span>
            <button type="button" className="bp-edit-btn" title="Read-only catalog">
              Read-Only
            </button>
          </div>
        </header>

        {/* ── 2-COLUMN OPEN LIBRARY LAYOUT ── */}
        <div className="bp-layout">
          {/* ── LEFT SIDEBAR ── */}
          <aside className="bp-left-col">
            {/* Book Cover */}
            <div className="bp-cover-wrapper" style={{ backgroundColor: placeholderBg }}>
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  className="bp-cover-img"
                  onError={(e) => {
                    e.target.style.display = "none";
                    if (e.target.nextElementSibling) {
                      e.target.nextElementSibling.style.display = "flex";
                    }
                  }}
                />
              ) : null}
              <div
                className="bp-cover-fallback"
                style={{ display: coverUrl ? "none" : "flex", backgroundColor: placeholderBg }}
              >
                <span className="bp-fallback-title">{book.title}</span>
                <span className="bp-fallback-author">{book.authorName}</span>
              </div>
            </div>

            {/* Borrow Button */}
            <div className="bp-borrow-group">
              {Number(book.availableBorrowCopies) <= 0 ? (
                <button
                  type="button"
                  className="bp-btn-borrow"
                  onClick={handleJoinBorrowList}
                  disabled={joiningBorrowList || Boolean(waitlistedBorrow) || Boolean(pendingBorrow) || Boolean(activeBorrow)}
                >
                  {joiningBorrowList
                    ? "Submitting..."
                    : pendingBorrow
                    ? "Pending Admin Approval"
                    : activeBorrow
                    ? "Currently Borrowed"
                    : waitlistedBorrow
                    ? "On Borrow List"
                    : "Join Borrow List"}
                </button>
              ) : (
                <button
                  type="button"
                  className="bp-btn-borrow"
                  onClick={handleBorrow}
                  disabled={borrowing || Boolean(pendingBorrow) || Boolean(activeBorrow)}
                >
                  {borrowing
                    ? "Submitting..."
                    : pendingBorrow
                    ? "Pending Admin Approval"
                    : activeBorrow
                    ? "Currently Borrowed"
                    : "Borrow"}
                </button>
              )}
              <button
                type="button"
                className="bp-btn-borrow-arrow"
                title={waitlistedBorrow ? "Already on your borrow list" : Number(book.availableBorrowCopies) <= 0 ? "Add to borrow list when available" : "Borrow available"}
                onClick={Number(book.availableBorrowCopies) <= 0 ? handleJoinBorrowList : handleBorrow}
                disabled={joiningBorrowList || borrowing || Boolean(waitlistedBorrow) || Boolean(pendingBorrow) || Boolean(activeBorrow)}
              >
                {joiningBorrowList || borrowing ? "…" : waitlistedBorrow ? "✓" : Number(book.availableBorrowCopies) <= 0 ? "+" : "▼"}
              </button>
            </div>

            {/* Order Button */}
            <button
              type="button"
              className="bp-btn-list"
              onClick={handleOrder}
              disabled={ordering || Boolean(pendingOrder) || Number(book.availableOrderCopies) <= 0}
            >
              {ordering
                ? "Placing order..."
                : pendingOrder
                ? "Pending Admin Approval"
                : Number(book.availableOrderCopies) <= 0
                ? "Out of Stock"
                : `Order book · TK ${Number(book.price || 0).toFixed(0)}`}
            </button>

            {/* Add to List */}
            <div className="bp-list-group">
              <button
                type="button"
                className="bp-btn-list"
                onClick={() => setShowListPicker((open) => !open)}
                disabled={addingToList}
              >
                {bookListTypes.length > 0
                  ? `✓ In ${bookListTypes.length} list${bookListTypes.length > 1 ? "s" : ""}`
                  : addingToList ? "Adding…" : "Add to List"}
              </button>
              <button
                type="button"
                className="bp-btn-list-arrow"
                title="Select list"
                onClick={() => setShowListPicker((open) => !open)}
              >
                ▼
              </button>
              {showListPicker && (
                <div className="bp-list-picker">
                  {WISHLIST_OPTIONS.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      type="button"
                      className={`bp-list-picker-item ${bookListTypes.includes(key) ? "active" : ""}`}
                      onClick={() => handleAddToList(key)}
                      disabled={bookListTypes.includes(key)}
                    >
                      <img className="bp-list-picker-icon" src={icon} alt="" aria-hidden="true" />
                      <span>{label}</span>
                      {bookListTypes.includes(key) && " ✓"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Extra Information */}
            <div className="bp-sidebar-extra">
              <div className="bp-sidebar-meta-item">
                <span>Book ID:</span>
                <strong>#{book.bookID}</strong>
              </div>
              {book.price != null && (
                <div className="bp-sidebar-meta-item">
                  <span>Price:</span>
                  <strong>TK {Number(book.price).toFixed(0)}</strong>
                </div>
              )}
            </div>
          </aside>

          {/* ── RIGHT MAIN CONTENT ── */}
          <main className="bp-right-col">
            {/* Edition Subtitle */}
            <p className="bp-edition-subtitle">
              An edition of <strong style={{ color: "#333" }}>{book.title}</strong> ({publishYear})
            </p>

            {/* Main Title */}
            <h1 className="bp-title">{book.title}</h1>

            {/* Author Line */}
            <div className="bp-author-line">
              by{" "}
              <span className="bp-author-link">
                {book.authorName || "Unknown Author"}
              </span>
            </div>

            {/* Ratings & Stats Row: Reflects database user reviews and wishlist stats */}
            <div className="bp-ratings-summary">
              <span className="bp-stars-display" title={`Average rating: ${ratingValue} out of 5 (${ratingCount} user ratings)`}>
                {starsDisplay}
              </span>
              <span className="bp-rating-score">{ratingValue}</span>
              <span className="bp-rating-count">
                ({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})
              </span>
              <span className="bp-rating-divider">·</span>
              <span className="bp-reading-stat">{wantToReadCount} Want to read</span>
              <span className="bp-rating-divider">·</span>
              <span className="bp-reading-stat">{currentlyReadingCount} Currently reading</span>
              <span className="bp-rating-divider">·</span>
              <span className="bp-reading-stat">{haveReadCount} Have read</span>
            </div>

            {/* Tab: Reviews */}
            {activeTab === "reviews" ? (
              <section className="bp-reviews-section">
                <div className="bp-reviews-header">
                  <div>
                    <h3 className="bp-reviews-title">User Reviews &amp; Ratings</h3>
                    <p className="bp-reviews-subtitle">
                      Community ratings from Central Library members
                    </p>
                  </div>
                </div>

                <div className="bp-reviews-stats-card">
                  <div className="bp-big-score-box">
                    <span className="bp-big-score">{ratingValue}</span>
                    <span className="bp-big-stars">{starsDisplay}</span>
                    <span className="bp-big-count">Based on {ratingCount} user {ratingCount === 1 ? "rating" : "ratings"}</span>
                  </div>
                </div>

                {reviews.length === 0 ? (
                  <div className="bp-empty-reviews">
                    <p>No user reviews recorded for this book yet.</p>
                    <p className="bp-sub-hint">Reviews and ratings can be submitted from your Member Dashboard once you borrow or purchase a copy.</p>
                  </div>
                ) : (
                  <div className="bp-reviews-list">
                    {reviews.map((rev) => (
                      <div key={rev.reviewID} className="bp-review-card">
                        <div className="bp-review-top">
                          <div className="bp-reviewer-info">
                            <span className="bp-reviewer-avatar">
                              {(rev.user_name || "M").charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <strong className="bp-reviewer-name">{rev.user_name || `Member #${rev.user_id}`}</strong>
                              <span className="bp-review-source-badge">
                                {rev.reviewSource === "BOUGHT" ? "Purchased Copy" : "Borrowed Copy"}
                              </span>
                            </div>
                          </div>
                          <div className="bp-review-meta">
                            <span className="bp-review-stars">
                              {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                            </span>
                            <span className="bp-review-date">
                              {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ""}
                            </span>
                          </div>
                        </div>
                        <p className="bp-review-comment">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : activeTab === "related books" ? (
              <section className="bp-related-section">
                <div className="bp-related-header">
                  <div>
                    <h3 className="bp-related-title">Related Books</h3>
                    <p className="bp-related-subtitle">
                      More books in {book.genre ? `"${book.genre}"` : "the library"}{book.authorName ? ` or by ${book.authorName}` : ""}
                    </p>
                  </div>
                </div>

                {loadingRelated ? (
                  <div className="bp-related-grid">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className="bp-rel-card bp-rel-skeleton" />
                    ))}
                  </div>
                ) : relatedBooks.length === 0 ? (
                  <div className="bp-related-empty">
                    <p>No related books found in the library catalog for this genre or author.</p>
                  </div>
                ) : (
                  <div className="bp-related-grid">
                    {relatedBooks.map((rel) => {
                      const relCover = rel.ISBN
                        ? `https://covers.openlibrary.org/b/isbn/${rel.ISBN}-M.jpg`
                        : null;
                      const relBg = getCoverColor(rel.title);
                      return (
                        <div
                          key={rel.bookID}
                          className="bp-rel-card"
                          onClick={() => handleRelatedBookClick(rel)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleRelatedBookClick(rel);
                            }
                          }}
                        >
                          <div className="bp-rel-cover-wrap" style={{ backgroundColor: relBg }}>
                            {relCover ? (
                              <img
                                src={relCover}
                                alt={rel.title}
                                className="bp-rel-cover-img"
                                loading="lazy"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  if (e.target.nextElementSibling) {
                                    e.target.nextElementSibling.style.display = "flex";
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className="bp-rel-fallback"
                              style={{ display: relCover ? "none" : "flex", backgroundColor: relBg }}
                            >
                              <span className="bp-rel-fb-title">{rel.title}</span>
                              <span className="bp-rel-fb-author">{rel.authorName || "Unknown"}</span>
                            </div>
                          </div>

                          <div className="bp-rel-info">
                            <span className="bp-rel-genre-pill">{rel.genre || "Book"}</span>
                            <h4 className="bp-rel-title" title={rel.title}>{rel.title}</h4>
                            <p className="bp-rel-author">by {rel.authorName || "Unknown Author"}</p>
                            
                            <div className="bp-rel-meta">
                              <span className="bp-rel-rating">
                                {rel.avgRating > 0 ? `★ ${Number(rel.avgRating).toFixed(1)}` : "☆ New"}
                              </span>
                              {rel.price > 0 && (
                                <span className="bp-rel-price">TK {Number(rel.price).toFixed(0)}</span>
                              )}
                            </div>

                            <div className="bp-rel-status-row">
                              <span className={`bp-rel-badge ${Number(rel.availableBorrowCopies) > 0 ? "in-stock" : "out-of-stock"}`}>
                                {Number(rel.availableBorrowCopies) > 0
                                  ? `${rel.availableBorrowCopies} available`
                                  : "Out of stock"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              /* Tab: Overview */
              <>
                {/* Synopsis Section */}
                <section className="bp-synopsis-box" aria-label="Book synopsis">
                  <h4 className="bp-synopsis-headline">SYNOPSIS &amp; OVERVIEW</h4>
                  {synopsisLoading && !synopsis ? (
                    <p className="bp-synopsis-text" style={{ fontStyle: "italic", color: "#777" }}>
                      Fetching book synopsis from Open Library…
                    </p>
                  ) : (
                    <>
                      <p className={`bp-synopsis-text ${expandedDesc ? "" : "collapsed"}`}>
                        {synopsis}
                      </p>
                      {synopsis.length > 200 && (
                        <button
                          type="button"
                          className="bp-read-more-btn"
                          onClick={() => setExpandedDesc((prev) => !prev)}
                        >
                          {expandedDesc ? "Read Less ⌃" : "Read More ⌄"}
                        </button>
                      )}
                      <div className="bp-synopsis-source">
                        Source: Open Library / Internet Archive Catalog
                      </div>
                    </>
                  )}
                </section>

                {/* 4-Box Overview Grid */}
                <div className="bp-overview-grid">
                  <div className="bp-overview-card">
                    <span className="bp-oc-label">Publish Date</span>
                    <span className="bp-oc-value">{publishYear}</span>
                  </div>
                  <div className="bp-overview-card">
                    <span className="bp-oc-label">Publisher</span>
                    <span className="bp-oc-value is-link" title={publisherName}>
                      {publisherName}
                    </span>
                  </div>
                  <div className="bp-overview-card">
                    <span className="bp-oc-label">Language</span>
                    <span className="bp-oc-value">{languageName}</span>
                  </div>
                  <div className="bp-overview-card">
                    <span className="bp-oc-label">Pages</span>
                    <span className="bp-oc-value">{pageCount}</span>
                  </div>
                </div>

                {/* Preview Availability */}
                <div className="bp-preview-info">
                  Previews available in: <span style={{ color: "#0066cc", fontWeight: 600 }}>English</span>
                </div>

                {/* Tags & Classifications */}
                <div className="bp-tags-container">
                  {subjects.length > 0 && (
                    <div className="bp-tag-row">
                      <span className="bp-tag-title">SUBJECTS</span>
                      <div className="bp-tag-list">
                        {subjects.map((s, idx) => (
                          <span key={idx} className="bp-tag-pill">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {people.length > 0 && (
                    <div className="bp-tag-row">
                      <span className="bp-tag-title">PEOPLE</span>
                      <div className="bp-tag-list">
                        {people.map((p, idx) => (
                          <span key={idx} className="bp-tag-pill">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {places.length > 0 && (
                    <div className="bp-tag-row">
                      <span className="bp-tag-title">PLACES</span>
                      <div className="bp-tag-list">
                        {places.map((place, idx) => (
                          <span key={idx} className="bp-tag-pill">
                            {place}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {times.length > 0 && (
                    <div className="bp-tag-row">
                      <span className="bp-tag-title">TIMES</span>
                      <div className="bp-tag-list">
                        {times.map((t, idx) => (
                          <span key={idx} className="bp-tag-pill">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Local Library Inventory Info Card */}
                <div className="bp-local-inventory">
                  <h4 className="bp-local-inventory-title">
                     Central Library Availability &amp; Catalog
                  </h4>
                  <div className="bp-inventory-grid">
                    <div className="bp-inv-item">
                      <span>Status:</span>
                      <span
                        className={`bp-inv-badge ${
                          (book.availableBorrowCopies ?? 1) > 0 ? "available" : "none"
                        }`}
                      >
                        {(book.availableBorrowCopies ?? 1) > 0 ? "In Circulation" : "Unavailable"}
                      </span>
                    </div>
                    <div className="bp-inv-item">
                      <span>Available Copies for Borrow:</span>
                      <strong>{book.availableBorrowCopies ?? 0} / {book.totalCopies ?? 0}</strong>
                    </div>
                    <div className="bp-inv-item">
                      <span>Available Copies for Order:</span>
                      <strong>{book.availableOrderCopies ?? 0}</strong>
                    </div>
                    <div className="bp-inv-item">
                      <span>Borrowed for:</span>
                      <strong>{book.borrowCount ?? 0} times</strong>
                    </div>
                    <div className="bp-inv-item">
                      <span>Sold:</span>
                      <strong>{book.soldCount ?? 0}</strong>
                    </div>
                    <div className="bp-inv-item">
                      <span>Edition:</span>
                      <strong>{book.edition || "Standard"}</strong>
                    </div>
                    <div className="bp-inv-item">
                      <span>ISBN:</span>
                      <strong style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {book.ISBN || "N/A"}
                      </strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
