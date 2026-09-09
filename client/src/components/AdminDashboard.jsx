import { useEffect, useState } from "react";
import "./Login.css";

const adminTabs = [
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
  const [returningBorrowID, setReturningBorrowID] = useState(null);
  const [approvingOrderID, setApprovingOrderID] = useState(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('library_token');
        const authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};

        const [summaryRes, booksRes, borrowRes, ordersRes] = await Promise.all([
          fetch('/api/admin/summary', { headers: authHeaders }),
          fetch('/api/admin/books', { headers: authHeaders }),
          fetch('/api/admin/borrow-records', { headers: authHeaders }),
          fetch('/api/admin/orders', { headers: authHeaders }),
        ]);

        const summaryData = summaryRes.ok ? await summaryRes.json() : summary;
        const booksData = booksRes.ok ? await booksRes.json() : [];
        const borrowData = borrowRes.ok ? await borrowRes.json() : [];
        const orderData = ordersRes.ok ? await ordersRes.json() : [];

        setSummary(summaryData);
        setBookInfo(booksData);
        setBorrowBookInfo(borrowData);
        setOrderedBookInfo(orderData);
      } catch {
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

  const processReturn = async (borrowID) => {
    setReturningBorrowID(borrowID);
    try {
      const token = localStorage.getItem('library_token');
      const response = await fetch(`/api/admin/borrow-records/${borrowID}/return`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not process return.');
      setBorrowBookInfo((current) => current.map((item) =>
        String(item.borrowid || item.borrowID) === String(borrowID)
          ? { ...item, status: data.record.status, returndate: data.record.returnDate, returnDate: data.record.returnDate }
          : item
      ));
      setBookInfo((current) => current.map((item) =>
        String(item.bookid || item.bookID) === String(data.record.bookID)
          ? { ...item, availablecopies: Number(item.availablecopies ?? item.availableCopies ?? 0) + 1 }
          : item
      ));
      setSummary((current) => ({ ...current, active_borrow_records: Math.max(0, Number(current.active_borrow_records || 0) - 1) }));
    } catch (error) {
      window.alert(error.message);
    } finally {
      setReturningBorrowID(null);
    }
  };

  const approveOrder = async (purchaseNo) => {
    setApprovingOrderID(purchaseNo);
    try {
      const token = localStorage.getItem('library_token');
      const response = await fetch(`/api/admin/orders/${purchaseNo}/approve`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not approve order.');
      setOrderedBookInfo((current) => current.map((item) =>
        String(item.purchaseno || item.purchaseNo) === String(purchaseNo)
          ? { ...item, status: data.order.status, approvedAt: data.order.approvedAt }
          : item
      ));
    } catch (error) {
      window.alert(error.message);
    } finally {
      setApprovingOrderID(null);
    }
  };

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
            <button
              type="button"
              className={`admin-info-button ${activeTab === "admin_info" ? "active" : ""}`}
              onClick={() => setActiveTab("admin_info")}
              aria-label="Open admin information"
              title="Admin information"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.25" />
                <path d="M5.5 20c.7-3.2 2.8-5 6.5-5s5.8 1.8 6.5 5" />
              </svg>
            </button>
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
                    <th>Status / Action</th>
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
                    <th>Action</th>
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
                      <td>
                        {(item.status || "").toUpperCase() === "BORROWED" ? (
                          <button type="button" className="btn btn-primary small-btn" disabled={returningBorrowID === (item.borrowid || item.borrowID)} onClick={() => processReturn(item.borrowid || item.borrowID)}>
                            {returningBorrowID === (item.borrowid || item.borrowID) ? "Processing..." : "Process Return"}
                          </button>
                        ) : (
                          <span>{item.returndate || item.returnDate || "Returned"}</span>
                        )}
                      </td>
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
                      <td>
                        {(item.status || "PENDING") === "PENDING" ? (
                          <button type="button" className="btn btn-primary small-btn" disabled={approvingOrderID === (item.purchaseno || item.purchaseNo)} onClick={() => approveOrder(item.purchaseno || item.purchaseNo)}>
                            {approvingOrderID === (item.purchaseno || item.purchaseNo) ? "Approving..." : "Approve Order"}
                          </button>
                        ) : <span>Approved</span>}
                      </td>
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
