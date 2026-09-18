import { useEffect, useState, useMemo } from "react";
import "./BookPage.css";
import messageCircleIcon from "../assets/message-circle.svg";
import iconBookOpen from "../assets/book-open.svg";
import iconBookmarkCheck from "../assets/bookmark-check.svg";
import iconStar from "../assets/star.svg";

const WISHLIST_OPTIONS = [
  { key: "CURRENTLY_READING", label: "Currently Reading", icon: iconBookOpen },
  { key: "WANT_TO_READ", label: "Want to Read", icon: iconBookmarkCheck },
  { key: "FAVORITES", label: "Favorites", icon: iconStar },
];

export default function BookPage({
  book: initialBook,
  bookId,
  onBack,
  onBorrow,
  onOrder,
  onReview,
  onAddToWishlist,
  wishlist = [],
}) {
  const [book, setBook] = useState(initialBook || null);
  const [olData, setOlData] = useState(null);
  const [synopsis, setSynopsis] = useState("");
  const [synopsisLoading, setSynopsisLoading] = useState(false);
  const [loadingBook, setLoadingBook] = useState(!initialBook);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [userStars, setUserStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [borrowing, setBorrowing] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  const effectiveBookId = bookId || initialBook?.bookID;
  const cleanIsbn = book?.ISBN ? String(book.ISBN).replace(/[^0-9X]/gi, "") : "";
  const bookListTypes = wishlist
    .filter((entry) => String(entry.bookID) === String(book?.bookID))
    .map((entry) => entry.listType);

  // ── 1. Fetch book from local backend if needed ───────────────────────────
  useEffect(() => {
    let isMounted = true;

    if (!effectiveBookId) return;
    if (book && String(book.bookID) === String(effectiveBookId)) return;

    async function loadLocalBook() {
      setLoadingBook(true);
      try {
        const token = localStorage.getItem("library_token");
        const headers = token ? { Authorization: "Bearer " + token } : {};
        const res = await fetch(`/api/books/search?field=bookID&keyword=${effectiveBookId}`, { headers });
        if (res.ok) {
          const list = await res.json();
          if (isMounted && Array.isArray(list) && list.length > 0) {
            setBook(list[0]);
          }
        }
      } catch (err) {
        console.warn("Could not fetch book by ID from local backend:", err);
      } finally {
        if (isMounted) setLoadingBook(false);
      }
    }

    loadLocalBook();

    return () => {
      isMounted = false;
    };
  }, [effectiveBookId, book]);

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
  const rawAvg = book.avgRating != null ? Number(book.avgRating) : 0.0;
  const ratingValue = rawAvg.toFixed(1);
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
            {["overview", "view editions", "details", "reviews", "lists", "related books"].map((tab) => (
              <li key={tab}>
                <button
                  type="button"
                  className={`bp-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
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

            {/* Borrowing requires admin approval; return processing is admin-only. */}
            <div className="bp-borrow-group">
              <button
                type="button"
                className="bp-btn-borrow"
                onClick={handleBorrow}
                disabled={borrowing || Number(book.availableCopies) <= 0}
              >
                {borrowing ? "Submitting..." : Number(book.availableCopies) > 0 ? "Borrow" : "Unavailable"}
              </button>
              <button
                type="button"
                className="bp-btn-borrow-arrow"
                title="More borrow options"
                onClick={() => alert("Options: Borrow e-Book, Reserve physical copy, Request extension")}
              >
                ▼
              </button>
            </div>

            <button type="button" className="bp-btn-list" onClick={handleOrder} disabled={ordering}>
              {ordering ? "Placing order..." : `Order book · $${Number(book.price || 0).toFixed(2)}`}
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

            {/* Interactive Rating Stars */}
            <div className="bp-rate-stars-wrapper" title="Rate this book">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`bp-star-btn ${star <= (hoverStars || userStars) ? "active" : ""}`}
                  onMouseEnter={() => setHoverStars(star)}
                  onMouseLeave={() => setHoverStars(0)}
                  onClick={() => setUserStars(star)}
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Action Row - Review Only with SVG Icon */}
            <div className="bp-action-row">
              <button
                type="button"
                className="bp-action-item"
                onClick={() => onReview?.(book)}
              >
                <img src={messageCircleIcon} alt="" className="bp-action-icon-img" aria-hidden="true" />
                <span>Review</span>
              </button>
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
                  <strong>${Number(book.price).toFixed(2)}</strong>
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

            {/* Ratings & Stats Row */}
            <div className="bp-ratings-summary">
              <span className="bp-stars-display">{starsDisplay}</span>
              <span className="bp-rating-score">{ratingValue}</span>
            </div>

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
                      (book.availableCopies ?? 1) > 0 ? "available" : "none"
                    }`}
                  >
                    {(book.availableCopies ?? 1) > 0 ? "In Circulation" : "Unavailable"}
                  </span>
                </div>
                <div className="bp-inv-item">
                  <span>Available Copies:</span>
                  <strong>{book.availableCopies ?? 1} / {book.totalCopies ?? 1}</strong>
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
          </main>
        </div>
      </div>
    </div>
  );
}
