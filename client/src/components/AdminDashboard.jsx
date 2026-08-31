import { useEffect, useState } from "react";
import "./Login.css";

const adminTabs = [
  { key: "admin_info", label: "Admin Info" },
  { key: "library_info", label: "Library Info" },
  { key: "book_info", label: "Book Info" },
  { key: "borrow_book_info", label: "Borrow Book Info" },
  { key: "ordered_book_info", label: "Ordered Book Info" },
];

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("admin_info");
  const [summary, setSummary] = useState({
    total_users: 0,
    total_books: 0,
    active_borrow_records: 0,
    total_orders: 0,
    total_library_reviews: 0,
  });
  const [bookInfo, setBookInfo] = useState([]);
  const [borrowBookInfo, setBorrowBookInfo] = useState([]);
  const [orderedBookInfo, setOrderedBookInfo] = useState([]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [summaryRes, booksRes, borrowRes, ordersRes] = await Promise.all([
          fetch("/api/admin/summary"),
          fetch("/api/admin/books"),
          fetch("/api/admin/borrow-records"),
          fetch("/api/admin/orders"),
        ]);

        const summaryData = summaryRes.ok ? await summaryRes.json() : summary;
        const booksData = booksRes.ok ? await booksRes.json() : [];
        const borrowData = borrowRes.ok ? await borrowRes.json() : [];
        const orderData = ordersRes.ok ? await ordersRes.json() : [];

        setSummary(summaryData);
        setBookInfo(booksData);
        setBorrowBookInfo(borrowData);
        setOrderedBookInfo(orderData);
      } catch (error) {
        setSummary({
          total_users: 0,
          total_books: 0,
          active_borrow_records: 0,
          total_orders: 0,
          total_library_reviews: 0,
        });
        setBookInfo([]);
        setBorrowBookInfo([]);
        setOrderedBookInfo([]);
      }
    };

    fetchAdminData();
  }, []);

  const adminInfo = [
    { label: "Admin ID", value: user?.userID ?? "N/A" },
    { label: "Name", value: user?.name ?? "N/A" },
    { label: "Email", value: user?.email ?? "N/A" },
    { label: "Role", value: user?.role ?? "ADMIN" },
  ];

  const libraryInfo = [
    { label: "Library Name", value: "Central Library" },
    { label: "Branch", value: "Main Campus" },
    { label: "Books Available", value: String(summary.total_books || 0) },
    { label: "Members", value: String(summary.total_users || 0) },
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
            <span className="badge-role">{user.role || "ADMIN"}</span>
            <button type="button" onClick={onLogout} className="btn btn-secondary small-btn">
              Sign Out
            </button>
          </div>
        </div>

        <div className="tab-buttons">
          {adminTabs.map((tab) => (
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

        {activeTab === "admin_info" && (
          <div className="content-panel">
            <h3>Admin Information</h3>
            <div className="info-grid">
              {adminInfo.map((item) => (
                <div key={item.label} className="info-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "library_info" && (
          <div className="content-panel">
            <h3>Library Information</h3>
            <div className="info-grid">
              {libraryInfo.map((item) => (
                <div key={item.label} className="info-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "book_info" && (
          <div className="content-panel">
            <h3>Book Info</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Book ID</th>
                    <th>Title</th>
                    <th>Genre</th>
                    <th>Author</th>
                    <th>Publisher</th>
                    <th>Available Copies</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {bookInfo.map((book) => (
                    <tr key={book.bookid || book.bookID}>
                      <td>{book.bookid ?? book.bookID}</td>
                      <td>{book.title}</td>
                      <td>{book.genre || "N/A"}</td>
                      <td>{book.author_names || book.authorName || "N/A"}</td>
                      <td>{book.publishername || book.publisherName || "N/A"}</td>
                      <td>{book.availablecopies ?? book.availableCopies ?? 0}</td>
                      <td>${Number(book.price || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "borrow_book_info" && (
          <div className="content-panel">
            <h3>Borrow Book Info</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Borrow ID</th>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Due Date</th>
                    <th>Return Date</th>
                    <th>Status</th>
                    <th>Delay Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowBookInfo.map((item) => (
                    <tr key={item.borrowid || item.borrowID}>
                      <td>{item.borrowid ?? item.borrowID}</td>
                      <td>{item.book_name || item.bookName || "N/A"}</td>
                      <td>{item.member_name || item.memberName || "N/A"}</td>
                      <td>{item.duedate || item.dueDate || "N/A"}</td>
                      <td>{item.returndate || item.returnDate || "Not returned"}</td>
                      <td>{item.status || "N/A"}</td>
                      <td>${Number(item.delayfee || item.delayFee || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "ordered_book_info" && (
          <div className="content-panel">
            <h3>Ordered Book Info</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Purchase No</th>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Order Date</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Publisher</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedBookInfo.map((item) => (
                    <tr key={item.purchaseno || item.purchaseNo}>
                      <td>{item.purchaseno ?? item.purchaseNo}</td>
                      <td>{item.book_name || item.bookName || "N/A"}</td>
                      <td>{item.member_name || item.memberName || "N/A"}</td>
                      <td>{item.orderdate || item.orderDate || "N/A"}</td>
                      <td>{item.quantity || 1}</td>
                      <td>${Number(item.price || 0).toFixed(2)}</td>
                      <td>{item.publisher_name || item.publisherName || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
