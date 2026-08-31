import { useEffect, useMemo, useState } from "react";
import "./Login.css";

const sampleBooks = [
  {
    bookID: 101,
    title: "The Hobbit",
    genre: "Fantasy",
    authorName: "J.R.R. Tolkien",
    publisher: "Houghton Mifflin",
    price: 18.5,
    ISBN: "978-0-261-10221-7",
  },
  {
    bookID: 102,
    title: "Pride and Prejudice",
    genre: "Classic",
    authorName: "Jane Austen",
    publisher: "Penguin Classics",
    price: 12.99,
    ISBN: "978-0-14-143951-8",
  },
  {
    bookID: 103,
    title: "The Alchemist",
    genre: "Fiction",
    authorName: "Paulo Coelho",
    publisher: "HarperOne",
    price: 14.25,
    ISBN: "978-0-06-112241-1",
  },
  {
    bookID: 104,
    title: "Atomic Habits",
    genre: "Self-Help",
    authorName: "James Clear",
    publisher: "Avery",
    price: 22.0,
    ISBN: "978-0-73-521129-2",
  },
  {
    bookID: 105,
    title: "The Great Gatsby",
    genre: "Classic",
    authorName: "F. Scott Fitzgerald",
    publisher: "Scribner",
    price: 11.75,
    ISBN: "978-0-684-80182-7",
  },
];

const searchOptions = [
  { value: "title", label: "Book Title" },
  { value: "bookID", label: "Book ID" },
  { value: "genre", label: "Genre" },
  { value: "author", label: "Author Name" },
  { value: "publisher", label: "Publisher" },
];

const borrowRecords = [
  {
    borrowID: 1,
    borrowDate: "2026-08-01",
    dueDate: "2026-08-15",
    returnDate: "2026-08-12",
    delayFee: 0,
    status: "RETURNED",
    bookID: 101,
    bookName: "The Hobbit",
  },
  {
    borrowID: 2,
    borrowDate: "2026-08-20",
    dueDate: "2026-09-03",
    returnDate: null,
    delayFee: 0,
    status: "BORROWED",
    bookID: 103,
    bookName: "The Alchemist",
  },
];

const bookReviews = [
  {
    reviewID: 11,
    rating: 5,
    comment: "Amazing book and very inspiring.",
    createdAt: "2026-08-10",
    book_id: 101,
    book_name: "The Hobbit",
  },
  {
    reviewID: 12,
    rating: 4,
    comment: "Good read and easy to follow.",
    createdAt: "2026-08-22",
    book_id: 103,
    book_name: "The Alchemist",
  },
];

const orderInfo = [
  {
    purchaseNo: 5001,
    orderDate: "2026-08-05",
    price: 18.5,
    book_id: 101,
    book_name: "The Hobbit",
    author_name: "J.R.R. Tolkien",
    publisher_name: "Houghton Mifflin",
  },
  {
    purchaseNo: 5002,
    orderDate: "2026-08-18",
    price: 14.25,
    book_id: 103,
    book_name: "The Alchemist",
    author_name: "Paulo Coelho",
    publisher_name: "HarperOne",
  },
];

const libraryReviews = [
  {
    libReviewID: 1,
    rating: 5,
    reportDetails: "Excellent library service and helpful staff.",
    createdAt: "2026-07-12",
  },
];

export default function Dashboard({ user, onLogout }) {
  const [searchField, setSearchField] = useState("title");
  const [searchValue, setSearchValue] = useState("");
  const [results, setResults] = useState(sampleBooks);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("user_info");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReviewData, setNewReviewData] = useState({
    rating: 5,
    reportDetails: "",
  });
  const [libraryReviewList, setLibraryReviewList] = useState(libraryReviews);
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [bookReviews, setBookReviews] = useState([]);
  const [orderInfo, setOrderInfo] = useState([]);

  useEffect(() => {
    const fetchUserDashboardData = async () => {
      if (!user?.userID) return;

      try {
        const [borrowRes, reviewRes, orderRes, libraryRes] = await Promise.all([
          fetch(`/api/users/${user.userID}/borrow-records`),
          fetch(`/api/users/${user.userID}/book-reviews`),
          fetch(`/api/users/${user.userID}/orders`),
          fetch(`/api/users/${user.userID}/library-reviews`),
        ]);

        const borrowData = borrowRes.ok ? await borrowRes.json() : [];
        const reviewData = reviewRes.ok ? await reviewRes.json() : [];
        const orderData = orderRes.ok ? await orderRes.json() : [];
        const libraryData = libraryRes.ok ? await libraryRes.json() : [];

        setBorrowRecords(borrowData.length ? borrowData : []);
        setBookReviews(reviewData.length ? reviewData : []);
        setOrderInfo(orderData.length ? orderData : []);
        setLibraryReviewList(libraryData.length ? libraryData : libraryReviews);
      } catch (error) {
        setBorrowRecords([]);
        setBookReviews([]);
        setOrderInfo([]);
        setLibraryReviewList(libraryReviews);
      }
    };

    fetchUserDashboardData();
  }, [user]);

  const selectedFieldLabel = useMemo(
    () =>
      searchOptions.find((option) => option.value === searchField)?.label ||
      "Book Title",
    [searchField]
  );

  const filterBooks = (field, value) => {
    const keyword = value.trim().toLowerCase();

    if (!keyword) {
      return sampleBooks;
    }

    return sampleBooks.filter((book) => {
      if (field === "bookID") {
        return String(book.bookID).includes(keyword);
      }

      const matchValue =
        field === "title"
          ? book.title
          : field === "genre"
          ? book.genre
          : field === "author"
          ? book.authorName
          : book.publisher;

      return matchValue.toLowerCase().includes(keyword);
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);

    try {
      const query = searchValue.trim();

      if (!query) {
        setResults(sampleBooks);
        return;
      }

      const response = await fetch(
        `/api/books/search?field=${encodeURIComponent(searchField)}&keyword=${encodeURIComponent(query)}`
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else {
        setResults(filterBooks(searchField, query));
      }
    } catch (error) {
      setResults(filterBooks(searchField, searchValue));
    } finally {
      setIsSearching(false);
    }
  };

  const handleLibraryReviewSubmit = async (e) => {
    e.preventDefault();

    if (!newReviewData.reportDetails.trim()) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.userID}/library-reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: Number(newReviewData.rating),
          reportDetails: newReviewData.reportDetails.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newEntry = data.review || {
          libReviewID: Date.now(),
          rating: Number(newReviewData.rating),
          reportDetails: newReviewData.reportDetails.trim(),
          createdAt: new Date().toISOString().slice(0, 10),
        };

        setLibraryReviewList((prev) => [newEntry, ...prev]);
      } else {
        const fallbackEntry = {
          libReviewID: Date.now(),
          rating: Number(newReviewData.rating),
          reportDetails: newReviewData.reportDetails.trim(),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setLibraryReviewList((prev) => [fallbackEntry, ...prev]);
      }

      setNewReviewData({ rating: 5, reportDetails: "" });
      setShowReviewForm(false);
    } catch (error) {
      const fallbackEntry = {
        libReviewID: Date.now(),
        rating: Number(newReviewData.rating),
        reportDetails: newReviewData.reportDetails.trim(),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setLibraryReviewList((prev) => [fallbackEntry, ...prev]);
      setNewReviewData({ rating: 5, reportDetails: "" });
      setShowReviewForm(false);
    }
  };

  const tabs = [
    { key: "user_info", label: "User Information" },
    { key: "borrow_record", label: "Borrow Record" },
    { key: "book_review", label: "Book Review" },
    { key: "order_info", label: "Order Info" },
    { key: "library_review", label: "Library Review" },
  ];

  return (
    <div className="dashboard-wrapper">
      <div className="mainpage-card">
        <div className="dashboard-header">
          <div>
            <h2>Welcome, {user.name}!</h2>
            <p className="auth-subtitle">{user.email}</p>
          </div>
          <div className="dashboard-actions">
            <span className="badge-role">{user.role || "MEMBER"}</span>
            <button type="button" onClick={onLogout} className="btn btn-secondary small-btn">
              Sign Out
            </button>
          </div>
        </div>

        <div className="top-review-bar">
          <h3>Library Review</h3>
          <button
            type="button"
            className="btn btn-primary small-btn"
            onClick={() => setShowReviewForm((prev) => !prev)}
          >
            {showReviewForm ? "Close Form" : "Review Again"}
          </button>
        </div>

        {showReviewForm && (
          <form className="review-form" onSubmit={handleLibraryReviewSubmit}>
            <div className="form-group inline-group">
              <label>Rating</label>
              <select
                value={newReviewData.rating}
                onChange={(e) =>
                  setNewReviewData((prev) => ({ ...prev, rating: e.target.value }))
                }
                className="form-control"
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Average</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Very Poor</option>
              </select>
            </div>

            <div className="form-group">
              <label>Review Details</label>
              <textarea
                rows={4}
                value={newReviewData.reportDetails}
                onChange={(e) =>
                  setNewReviewData((prev) => ({ ...prev, reportDetails: e.target.value }))
                }
                className="form-control"
                placeholder="Write your feedback about the library..."
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Submit Review
            </button>
          </form>
        )}

        <div className="tab-buttons">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "tab-button active" : "tab-button"}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "user_info" && (
          <div className="content-panel">
            <h3>User Information</h3>
            <div className="info-grid">
              <div className="info-card"><span>User ID</span><strong>{user.userID}</strong></div>
              <div className="info-card"><span>Name</span><strong>{user.name}</strong></div>
              <div className="info-card"><span>Email</span><strong>{user.email}</strong></div>
              <div className="info-card"><span>Phone</span><strong>{user.phone || "N/A"}</strong></div>
              <div className="info-card"><span>Address</span><strong>{user.address || "N/A"}</strong></div>
              <div className="info-card"><span>Role</span><strong>{user.role || "MEMBER"}</strong></div>
              <div className="info-card full-width"><span>Created At</span><strong>{user.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A"}</strong></div>
            </div>
          </div>
        )}

        {activeTab === "borrow_record" && (
          <div className="content-panel">
            <h3>Borrow Record</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Borrow ID</th>
                    <th>Book ID</th>
                    <th>Book Name</th>
                    <th>Borrow Date</th>
                    <th>Due Date</th>
                    <th>Return Date</th>
                    <th>Delay Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowRecords.map((record) => (
                    <tr key={record.borrowID}>
                      <td>{record.borrowID}</td>
                      <td>{record.bookID}</td>
                      <td>{record.bookName}</td>
                      <td>{record.borrowDate}</td>
                      <td>{record.dueDate}</td>
                      <td>{record.returnDate || "Not returned yet"}</td>
                      <td>${Number(record.delayFee).toFixed(2)}</td>
                      <td><span className="status-badge">{record.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "book_review" && (
          <div className="content-panel">
            <h3>Book Review</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Review ID</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Created At</th>
                    <th>Book ID</th>
                    <th>Book Name</th>
                  </tr>
                </thead>
                <tbody>
                  {bookReviews.map((review) => (
                    <tr key={review.reviewID}>
                      <td>{review.reviewID}</td>
                      <td>{review.rating}/5</td>
                      <td>{review.comment}</td>
                      <td>{review.createdAt}</td>
                      <td>{review.book_id}</td>
                      <td>{review.book_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "order_info" && (
          <div className="content-panel">
            <h3>Order Info</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Purchase No</th>
                    <th>Book ID</th>
                    <th>Book Name</th>
                    <th>Author Name</th>
                    <th>Publisher Name</th>
                    <th>Order Date</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {orderInfo.map((order) => (
                    <tr key={order.purchaseNo}>
                      <td>{order.purchaseNo}</td>
                      <td>{order.book_id}</td>
                      <td>{order.book_name}</td>
                      <td>{order.author_name}</td>
                      <td>{order.publisher_name}</td>
                      <td>{order.orderDate}</td>
                      <td>${Number(order.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "library_review" && (
          <div className="content-panel">
            <h3>Library Review</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Review ID</th>
                    <th>Rating</th>
                    <th>Previous Review</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {libraryReviewList.map((item) => (
                    <tr key={item.libReviewID}>
                      <td>{item.libReviewID}</td>
                      <td>{item.rating}/5</td>
                      <td>{item.reportDetails}</td>
                      <td>{item.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form className="search-panel" onSubmit={handleSearch}>
          <div className="search-header-row">
            <label htmlFor="search-field" className="search-label">
              Search by
            </label>
            <select
              id="search-field"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              className="search-select"
            >
              {searchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="search-input-row">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Search by ${selectedFieldLabel.toLowerCase()}`}
              className="form-control"
            />
            <button type="submit" className="btn btn-primary" disabled={isSearching}>
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        <div className="results-section">
          <div className="results-header">
            <h3>Books</h3>
            <span>{results.length} result(s)</span>
          </div>

          {results.length === 0 ? (
            <div className="empty-state">No books found for this search.</div>
          ) : (
            <div className="book-list">
              {results.map((book) => (
                <div className="book-card" key={book.bookID}>
                  <div className="book-top-row">
                    <h4>{book.title}</h4>
                    <span className="book-id">#{book.bookID}</span>
                  </div>

                  <div className="book-meta">
                    <span>
                      <strong>Genre:</strong> {book.genre}
                    </span>
                    <span>
                      <strong>Author:</strong> {book.authorName}
                    </span>
                    <span>
                      <strong>Publisher:</strong> {book.publisher}
                    </span>
                    <span>
                      <strong>ISBN:</strong> {book.ISBN}
                    </span>
                  </div>

                  <div className="book-footer">
                    <span className="book-price">${book.price.toFixed(2)}</span>
                    <button type="button" className="btn btn-secondary small-btn">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
