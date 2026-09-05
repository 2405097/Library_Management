import { useEffect, useMemo, useState } from "react";
import "./MemberWorkspace.css";
import iconBookOpen from "../assets/book-open.svg";
import iconBookmark from "../assets/bookmark-check.svg";
import iconReview from "../assets/message-square-quote.svg";
import iconCart from "../assets/shopping-cart-plus.svg";

const demoBooks = [
  {
    bookID: 101,
    title: "The Hobbit",
    genre: "Fantasy",
    language: "English",
    authorName: "J.R.R. Tolkien",
    authorNationality: "English",
    authorBiography: "A celebrated storyteller whose work shaped modern fantasy literature.",
    publisher: "Houghton Mifflin",
    publisherAddress: "Boston, Massachusetts",
    price: 18.5,
    avg_rating: 4.8,
    availableCopies: 4,
    totalCopies: 6,
    ISBN: "978-0-261-10221-7",
    reviews: [{ rating: 5, comment: "A warm, adventurous classic." }],
  },
  {
    bookID: 102,
    title: "Pride and Prejudice",
    genre: "Classic",
    language: "English",
    authorName: "Jane Austen",
    authorNationality: "English",
    authorBiography: "Known for sharp social observation, wit, and enduring romantic novels.",
    publisher: "Penguin Classics",
    publisherAddress: "London, United Kingdom",
    price: 12.99,
    avg_rating: 4.7,
    availableCopies: 0,
    totalCopies: 5,
    ISBN: "978-0-14-143951-8",
    reviews: [{ rating: 5, comment: "Clever, funny, and endlessly re-readable." }],
  },
  {
    bookID: 103,
    title: "The Alchemist",
    genre: "Fiction",
    language: "English",
    authorName: "Paulo Coelho",
    authorNationality: "Brazilian",
    authorBiography: "A Brazilian novelist celebrated for philosophical, spiritual fiction.",
    publisher: "HarperOne",
    publisherAddress: "San Francisco, California",
    price: 14.25,
    avg_rating: 4.4,
    availableCopies: 3,
    totalCopies: 4,
    ISBN: "978-0-06-112241-1",
    reviews: [{ rating: 4, comment: "A gentle book about listening to your purpose." }],
  },
  {
    bookID: 104,
    title: "Atomic Habits",
    genre: "Self-Help",
    language: "English",
    authorName: "James Clear",
    authorNationality: "American",
    authorBiography: "An author and speaker focused on habits, decision-making, and continuous improvement.",
    publisher: "Avery",
    publisherAddress: "New York, New York",
    price: 22,
    avg_rating: 4.6,
    availableCopies: 8,
    totalCopies: 10,
    ISBN: "978-0-73-521129-2",
    reviews: [{ rating: 5, comment: "Practical ideas that are easy to put into practice." }],
  },
];

const views = [
  { key: "browse", label: "Browse Books", icon: iconBookOpen },
  { key: "borrows", label: "Track Borrows", icon: iconBookmark },
  { key: "reviews", label: "Write Reviews", icon: iconReview },
  { key: "orders", label: "Order Books", icon: iconCart },
];

const searchFields = [
  { value: "title", label: "Title" },
  { value: "genre", label: "Genre" },
  { value: "author", label: "Author" },
  { value: "publisher", label: "Publisher" },
  { value: "language", label: "Language" },
];

const getBookValue = (book, field) => {
  if (field === "author") return book.authorName || book.author_name || "";
  if (field === "publisher") return book.publisher || book.publisherName || "";
  return book[field] || "";
};

const normalizeBook = (book) => ({
  ...book,
  authorName: book.authorName || book.author_name || "Unknown author",
  publisher: book.publisher || book.publisherName || "Independent publisher",
  language: book.language || "English",
  avg_rating: Number(book.avg_rating ?? book.avgRating ?? 0),
  availableCopies: Number(book.availableCopies ?? book.availablecopies ?? 0),
  totalCopies: Number(book.totalCopies ?? book.totalcopies ?? 0),
  price: Number(book.price || 0),
  reviews: book.reviews || [],
});

export default function MemberWorkspace({ user, onLogout }) {
  const [activeView, setActiveView] = useState("browse");
  const [books, setBooks] = useState(demoBooks);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState("title");
  const [selectedBook, setSelectedBook] = useState(null);
  const [cart, setCart] = useState([]);
  const [notice, setNotice] = useState("");
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [bookReviews, setBookReviews] = useState([]);
  const [libraryReviews, setLibraryReviews] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviewTab, setReviewTab] = useState("book");
  const [bookReview, setBookReview] = useState({ bookID: "", rating: 5, comment: "" });
  const [libraryReview, setLibraryReview] = useState({ rating: 5, reportDetails: "" });
  const [searching, setSearching] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  useEffect(() => {
    if (!user?.userID) return;
    const base = `/api/users/${user.userID}`;
    Promise.all([
      fetch(`${base}/borrow-records`),
      fetch(`${base}/book-reviews`),
      fetch(`${base}/orders`),
      fetch(`${base}/library-reviews`),
    ]).then(async ([borrowRes, reviewRes, orderRes, libraryRes]) => {
      setBorrowRecords(borrowRes.ok ? await borrowRes.json() : []);
      setBookReviews(reviewRes.ok ? await reviewRes.json() : []);
      setOrders(orderRes.ok ? await orderRes.json() : []);
      setLibraryReviews(libraryRes.ok ? await libraryRes.json() : []);
    }).catch(() => setNotice("Some account history could not be loaded."));
  }, [user]);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return books;
    return books.filter((book) => getBookValue(book, searchField).toLowerCase().includes(normalizedQuery));
  }, [books, query, searchField]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) {
      setBooks(demoBooks);
      return;
    }
    setSearching(true);
    try {
      if (searchField === "language") {
        setBooks(demoBooks.filter((book) => book.language.toLowerCase().includes(query.toLowerCase())));
      } else {
        const response = await fetch(`/api/books/search?field=${encodeURIComponent(searchField)}&keyword=${encodeURIComponent(query.trim())}`);
        const data = response.ok ? await response.json() : [];
        setBooks(data.length ? data.map(normalizeBook) : demoBooks);
      }
    } catch {
      setBooks(demoBooks);
      showNotice("Showing the local catalog while the search service is unavailable.");
    } finally {
      setSearching(false);
    }
  };

  const addToCart = (book) => {
    if (book.availableCopies === 0) {
      showNotice("This title is currently out of stock.");
      return;
    }
    setCart((current) => [...current, book]);
    setSelectedBook(null);
    showNotice(`${book.title} added to your order.`);
  };

  const submitLibraryReview = async (event) => {
    event.preventDefault();
    if (!libraryReview.reportDetails.trim()) return;
    try {
      const response = await fetch(`/api/users/${user.userID}/library-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: Number(libraryReview.rating), reportDetails: libraryReview.reportDetails.trim() }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setLibraryReviews((current) => [data.review || data, ...current]);
    } catch {
      setLibraryReviews((current) => [{ libReviewID: Date.now(), ...libraryReview, createdAt: new Date().toISOString() }, ...current]);
    }
    setLibraryReview({ rating: 5, reportDetails: "" });
    showNotice("Your library review was submitted.");
  };

  const submitBookReview = (event) => {
    event.preventDefault();
    const book = books.find((item) => String(item.bookID) === String(bookReview.bookID));
    if (!book || !bookReview.comment.trim()) return;
    setBookReviews((current) => [{ reviewID: Date.now(), book_name: book.title, createdAt: new Date().toISOString(), ...bookReview }, ...current]);
    setBookReview({ bookID: "", rating: 5, comment: "" });
    showNotice("Your book review was submitted.");
  };

  const confirmPurchase = () => {
    if (!cart.length) return;
    setOrders((current) => [{ purchaseNo: Date.now(), orderDate: new Date().toISOString(), price: cart.reduce((sum, book) => sum + book.price, 0), book_name: cart.map((book) => book.title).join(", ") }, ...current]);
    setCart([]);
    setPurchaseComplete(true);
    showNotice("Purchase confirmed. Your order summary is ready.");
  };

  const openBorrowView = () => {
    setSelectedBook(null);
    setActiveView("borrows");
    showNotice("Borrow requests are recorded in your borrow history.");
  };

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <button className="workspace-brand" onClick={() => setActiveView("browse")} aria-label="Go to browse books">
          <img src={iconBookOpen} alt="" aria-hidden="true" />
          <span>Library<strong>MS</strong></span>
        </button>
        <nav className="workspace-nav" aria-label="Library sections">
          {views.map((view) => (
            <button key={view.key} className={activeView === view.key ? "active" : ""} onClick={() => setActiveView(view.key)}>
              <img src={view.icon} alt="" aria-hidden="true" />
              {view.label}
            </button>
          ))}
        </nav>
        <div className="workspace-account">
          <button
            className={`member-info-button ${activeView === "member" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("member")}
            aria-label="Open member information"
            title="Member information"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.25" />
              <path d="M5.5 20c.7-3.2 2.8-5 6.5-5s5.8 1.8 6.5 5" />
            </svg>
          </button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </header>

      {notice && <div className="workspace-toast" role="status">{notice}</div>}

      <main className="workspace-main">
        {activeView === "member" && (
          <section className="view-section narrow-view">
            <div className="view-intro compact">
              <p className="eyebrow">Member profile</p>
              <h1>Your library <em>identity.</em></h1>
              <p>Keep your student information close while you explore, borrow, review, and order books.</p>
            </div>
            <div className="member-profile-layout">
              <div className="member-profile-card member-profile-summary">
                <div className="member-avatar" aria-hidden="true">{(user.name || "M").charAt(0).toUpperCase()}</div>
                <p className="eyebrow">Student member</p>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
                <span className="member-role">{user.role || "MEMBER"}</span>
              </div>
              <div className="member-profile-card">
                <div className="data-card-heading"><h2>Personal information</h2><span>Account details</span></div>
                <dl className="member-details">
                  <div><dt>Member ID</dt><dd>#{user.userID}</dd></div>
                  <div><dt>Full name</dt><dd>{user.name || "Not provided"}</dd></div>
                  <div><dt>Email address</dt><dd>{user.email || "Not provided"}</dd></div>
                  <div><dt>Phone number</dt><dd>{user.phone || "Not provided"}</dd></div>
                  <div><dt>Address</dt><dd>{user.address || "Not provided"}</dd></div>
                  <div><dt>Member since</dt><dd>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Not available"}</dd></div>
                </dl>
              </div>
            </div>
          </section>
        )}

        {activeView === "browse" && (
          <section className="view-section">
            <div className="view-intro">
              <p className="eyebrow">The collection</p>
              <h1>Find your next<br /><em>good read.</em></h1>
              <p>Explore titles, follow your interests, and keep every library moment in one place.</p>
            </div>
            <form className="catalog-search" onSubmit={handleSearch}>
              <select value={searchField} onChange={(event) => setSearchField(event.target.value)} aria-label="Search books by">
                {searchFields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
              </select>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection..." aria-label="Search the collection" />
              <button type="submit" disabled={searching}>{searching ? "Searching" : "Search"}</button>
            </form>
            <div className="section-heading"><div><p className="eyebrow">Curated shelves</p><h2>{query ? `${filteredBooks.length} matches` : "Books for every mood"}</h2></div><span>{filteredBooks.length} titles</span></div>
            <div className="book-grid">
              {filteredBooks.map((book) => {
                const available = book.availableCopies > 0;
                return <article className="catalog-card" key={book.bookID}>
                  <div className="book-spine"><span>{book.genre || "Featured"}</span><strong>{book.title}</strong><small>{book.authorName}</small></div>
                  <div className="catalog-card-body"><div className="catalog-card-top"><span className={`availability ${available ? "available" : "sold-out"}`}>{available ? `${book.availableCopies} available` : "Out of stock"}</span><span className="rating">★ {book.avg_rating.toFixed(1)}</span></div><h3>{book.title}</h3><p>{book.authorName} · {book.publisher}</p><div className="catalog-card-footer"><strong>${book.price.toFixed(2)}</strong><button onClick={() => setSelectedBook(book)}>View details</button></div></div>
                </article>;
              })}
            </div>
          </section>
        )}

        {activeView === "borrows" && <section className="view-section narrow-view"><div className="view-intro compact"><p className="eyebrow">Your reading record</p><h1>Track <em>borrows.</em></h1><p>Stay ahead of due dates and see where each title is in your reading journey.</p></div><div className="data-card"><div className="data-card-heading"><h2>Borrowing history</h2><span>{borrowRecords.length} records</span></div>{borrowRecords.length ? <div className="table-scroll"><table><thead><tr><th>Book</th><th>Borrowed</th><th>Due date</th><th>Returned</th><th>Delay fee</th><th>Status</th></tr></thead><tbody>{borrowRecords.map((record) => <tr key={record.borrowID}><td><strong>{record.bookName || record.bookID}</strong></td><td>{record.borrowDate || "—"}</td><td>{record.dueDate || "—"}</td><td>{record.returnDate || "Not returned"}</td><td>${Number(record.delayFee || 0).toFixed(2)}</td><td><span className={`status-pill ${(record.status || "").toLowerCase()}`}>{record.status}</span></td></tr>)}</tbody></table></div> : <EmptyState text="Your borrowing history will appear here." />}</div></section>}

        {activeView === "reviews" && <section className="view-section narrow-view"><div className="view-intro compact"><p className="eyebrow">Your voice matters</p><h1>Write a <em>review.</em></h1><p>Help another reader discover a book or help us make the library better.</p></div><div className="review-tabs"><button className={reviewTab === "book" ? "active" : ""} onClick={() => setReviewTab("book")}>Review a book</button><button className={reviewTab === "library" ? "active" : ""} onClick={() => setReviewTab("library")}>Review the library</button></div>{reviewTab === "book" ? <form className="form-card" onSubmit={submitBookReview}><label>Book<select required value={bookReview.bookID} onChange={(event) => setBookReview({ ...bookReview, bookID: event.target.value })}><option value="">Choose a title</option>{books.map((book) => <option key={book.bookID} value={book.bookID}>{book.title}</option>)}</select></label><StarPicker value={bookReview.rating} onChange={(rating) => setBookReview({ ...bookReview, rating })} /><label>Your review<textarea required value={bookReview.comment} onChange={(event) => setBookReview({ ...bookReview, comment: event.target.value })} placeholder="What stayed with you?" /></label><button className="primary-action">Submit review</button></form> : <form className="form-card" onSubmit={submitLibraryReview}><StarPicker value={libraryReview.rating} onChange={(rating) => setLibraryReview({ ...libraryReview, rating })} /><label>Your review<textarea required value={libraryReview.reportDetails} onChange={(event) => setLibraryReview({ ...libraryReview, reportDetails: event.target.value })} placeholder="Tell us about your library experience..." /></label><button className="primary-action">Submit review</button></form>}<div className="review-list">{(reviewTab === "book" ? bookReviews : libraryReviews).slice(0, 4).map((review) => <div className="review-row" key={review.reviewID || review.libReviewID}><span className="review-stars">{"★".repeat(Number(review.rating || 0))}</span><p>{review.comment || review.reportDetails}</p><small>{review.book_name || "Library review"}</small></div>)}</div></section>}

        {activeView === "orders" && <section className="view-section narrow-view"><div className="view-intro compact"><p className="eyebrow">Take it home</p><h1>Order <em>books.</em></h1><p>Build a small stack of favorites and review your order before confirming.</p></div>{purchaseComplete ? <div className="success-card"><span>✓</span><h2>Order confirmed</h2><p>Your purchase has been added to your order history.</p><button className="secondary-action" onClick={() => setPurchaseComplete(false)}>View order history</button></div> : <div className="order-layout"><div className="data-card cart-card"><div className="data-card-heading"><h2>Your cart</h2><span>{cart.length} titles</span></div>{cart.length ? cart.map((book, index) => <div className="cart-row" key={`${book.bookID}-${index}`}><div><strong>{book.title}</strong><small>{book.authorName}</small></div><span>${book.price.toFixed(2)}</span><button aria-label={`Remove ${book.title}`} onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>) : <EmptyState text="Your cart is waiting for a good story." />} {cart.length > 0 && <div className="cart-total"><span>Total</span><strong>${cart.reduce((sum, book) => sum + book.price, 0).toFixed(2)}</strong></div>}</div><div className="data-card order-history"><div className="data-card-heading"><h2>Order history</h2><span>{orders.length} orders</span></div>{orders.length ? orders.slice(0, 5).map((order) => <div className="history-row" key={order.purchaseNo}><span>#{order.purchaseNo}</span><p>{order.book_name || "Book order"}</p><strong>${Number(order.price || 0).toFixed(2)}</strong></div>) : <EmptyState text="Confirmed purchases will appear here." />}</div></div>}{!purchaseComplete && <button className="primary-action confirm-action" disabled={!cart.length} onClick={confirmPurchase}>Confirm purchase · ${cart.reduce((sum, book) => sum + book.price, 0).toFixed(2)}</button>}</section>}
      </main>

      {selectedBook && <div className="modal-backdrop" onClick={() => setSelectedBook(null)}><article className="book-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedBook(null)} aria-label="Close details">×</button><p className="eyebrow">Book details · #{selectedBook.bookID}</p><h2>{selectedBook.title}</h2><p className="modal-author">{selectedBook.authorName} · {selectedBook.language}</p><div className="detail-grid"><div><span>Genre</span><strong>{selectedBook.genre}</strong></div><div><span>Publisher</span><strong>{selectedBook.publisher}</strong></div><div><span>Author nationality</span><strong>{selectedBook.authorNationality || "Not listed"}</strong></div><div><span>Publisher address</span><strong>{selectedBook.publisherAddress || "Not listed"}</strong></div></div><p className="biography">{selectedBook.authorBiography || "The library has not added a biography for this author yet."}</p><h3>Reader reviews</h3><div className="modal-reviews">{selectedBook.reviews?.length ? selectedBook.reviews.map((review, index) => <p key={index}><span>★ {review.rating}</span>{review.comment}</p>) : <p>No reviews yet. Be the first to share your thoughts.</p>}</div><div className="modal-actions"><button className="secondary-action" onClick={openBorrowView}>Borrow book</button><button className="primary-action" onClick={() => addToCart(selectedBook)}>Purchase · ${selectedBook.price.toFixed(2)}</button></div></article></div>}
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return <div className="star-picker" aria-label="Rating"><span>Rating</span>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={star <= value ? "selected" : ""} onClick={() => onChange(star)} aria-label={`${star} stars`}>★</button>)}</div>;
}

function EmptyState({ text }) {
  return <div className="empty-state"><span>○</span><p>{text}</p></div>;
}
