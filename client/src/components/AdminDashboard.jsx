import { useEffect, useState } from "react";
import "./Login.css";
import AccountDeletionDialog from "./AccountDeletionDialog";

const adminTabs = [
  { key: "member_info", label: "Member Info" },
  { key: "admin_info", label: "Admin Info" },
  { key: "signup_approvals", label: "Signup Approval" },
  { key: "library_info", label: "Library Info" },
  { key: "book_info", label: "Book Info" },
  { key: "borrow_book_info", label: "Borrow Book Info" },
  { key: "ordered_book_info", label: "Ordered Book Info" },
  { key: "book_reviews", label: "Book Reviews" },
  { key: "feedback", label: "Feedback" },
];

const formatDate = (val, fallback = "—") => {
  if (!val) return fallback;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? fallback : val.toISOString().split("T")[0];
  }
  const str = String(val).trim();
  if (!str) return fallback;
  if (str.includes("T")) {
    return str.split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? str : parsed.toISOString().split("T")[0];
};

export default function AdminDashboard({ user, onLogout, onAccountDeleted }) {
  const [activeTab, setActiveTab] = useState("admin_profile");
  const [summary, setSummary] = useState({
    total_users: 0,
    total_books: 0,
    active_borrow_records: 0,
    pending_borrow_requests: 0,
    total_orders: 0,
    total_library_reviews: 0,
  });
  const [bookInfo, setBookInfo] = useState([]);
  const [borrowBookInfo, setBorrowBookInfo] = useState([]);
  const [orderedBookInfo, setOrderedBookInfo] = useState([]);
  const [bookReviews, setBookReviews] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [pendingSignups, setPendingSignups] = useState([]);
  const [approvingSignupID, setApprovingSignupID] = useState(null);
  const [returningBorrowID, setReturningBorrowID] = useState(null);
  const [approvingOrderID, setApprovingOrderID] = useState(null);
  const [rejectingOrderID, setRejectingOrderID] = useState(null);
  const [approvingBorrowID, setApprovingBorrowID] = useState(null);
  const [rejectingBorrowID, setRejectingBorrowID] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('library_token');
        const authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};

        const [summaryRes, booksRes, borrowRes, ordersRes, reviewsRes, feedbackRes, usersRes] = await Promise.all([
          fetch('/api/admin/summary', { headers: authHeaders }),
          fetch('/api/admin/books', { headers: authHeaders }),
          fetch('/api/admin/borrow-records', { headers: authHeaders }),
          fetch('/api/admin/orders', { headers: authHeaders }),
          fetch('/api/admin/book-reviews', { headers: authHeaders }),
          fetch('/api/admin/feedback', { headers: authHeaders }),
          fetch('/api/users', { headers: authHeaders }),
        ]);

        const summaryData = summaryRes.ok ? await summaryRes.json() : summary;
        const booksData = booksRes.ok ? await booksRes.json() : [];
        const borrowData = borrowRes.ok ? await borrowRes.json() : [];
        const orderData = ordersRes.ok ? await ordersRes.json() : [];
        const reviewData = reviewsRes.ok ? await reviewsRes.json() : [];
        const feedbackData = feedbackRes.ok ? await feedbackRes.json() : [];
        const usersData = usersRes.ok ? await usersRes.json() : [];

        setSummary(summaryData);
        setBookInfo(booksData);
        setBorrowBookInfo(borrowData);
        setOrderedBookInfo(orderData);
        setBookReviews(reviewData);
        setFeedback(feedbackData);
        setMembers(usersData.filter((account) => account.role === "MEMBER"));
        setAdmins(usersData.filter((account) => account.role === "ADMIN"));
        setPendingSignups(usersData.filter((account) => account.isApproved === false));
      } catch {
        setSummary({
          total_users: 0,
          total_books: 0,
          active_borrow_records: 0,
          pending_borrow_requests: 0,
          total_orders: 0,
          total_library_reviews: 0,
        });
        setBookInfo([]);
        setBorrowBookInfo([]);
        setOrderedBookInfo([]);
        setMembers([]);
        setAdmins([]);
        setPendingSignups([]);
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

  const approveBorrow = async (borrowID) => {
    setApprovingBorrowID(borrowID);
    try {
      const token = localStorage.getItem('library_token');
      const response = await fetch(`/api/admin/borrow-records/${borrowID}/approve`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not approve borrow request.');
      setBorrowBookInfo((current) => current.map((item) =>
        String(item.borrowid || item.borrowID) === String(borrowID)
          ? {
              ...item,
              status: data.record.status,
              borrowdate: data.record.borrowDate,
              borrowDate: data.record.borrowDate,
              duedate: data.record.dueDate,
              dueDate: data.record.dueDate,
              approvedAt: data.record.approvedAt,
            }
          : item
      ));
      setSummary((current) => ({
        ...current,
        active_borrow_records: Number(current.active_borrow_records || 0) + 1,
      }));
    } catch (error) {
      window.alert(error.message);
    } finally {
      setApprovingBorrowID(null);
    }
  };

  const rejectBorrow = async (borrowID) => {
    setRejectingBorrowID(borrowID);
    try {
      const token = localStorage.getItem('library_token');
      const response = await fetch(`/api/admin/borrow-records/${borrowID}/reject`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not reject borrow request.');
      setBorrowBookInfo((current) => current.map((item) =>
        String(item.borrowid || item.borrowID) === String(borrowID)
          ? { ...item, status: data.record.status }
          : item
      ));
      if (data.record?.bookID) {
        setBookInfo((current) => current.map((item) =>
          String(item.bookid || item.bookID) === String(data.record.bookID)
            ? { ...item, availablecopies: Number(item.availablecopies ?? item.availableCopies ?? 0) + 1 }
            : item
        ));
      }
    } catch (error) {
      window.alert(error.message);
    } finally {
      setRejectingBorrowID(null);
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

  const rejectOrder = async (purchaseNo) => {
    setRejectingOrderID(purchaseNo);
    try {
      const token = localStorage.getItem('library_token');
      const response = await fetch(`/api/admin/orders/${purchaseNo}/reject`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not reject order.');
      setOrderedBookInfo((current) => current.map((item) =>
        String(item.purchaseno || item.purchaseNo) === String(purchaseNo)
          ? { ...item, status: data.order.status }
          : item
      ));
      if (data.order?.bookID) {
        setBookInfo((current) => current.map((item) =>
          String(item.bookid || item.bookID) === String(data.order.bookID)
            ? { ...item, availablecopies: Number(item.availablecopies ?? item.availableCopies ?? 0) + Number(data.order.quantity || 1) }
            : item
        ));
      }
    } catch (error) {
      window.alert(error.message);
    } finally {
      setRejectingOrderID(null);
    }
  };

  const approveSignup = async (userID) => {
    setApprovingSignupID(userID);
    try {
      const token = localStorage.getItem('library_token');
      const response = await fetch(`/api/admin/signup-approvals/${userID}/approve`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not approve signup.');
      setPendingSignups((current) => current.filter((account) => String(account.userID) !== String(userID)));
      setMembers((current) => current.map((account) => String(account.userID) === String(userID) ? data.user : account));
      setAdmins((current) => current.map((account) => String(account.userID) === String(userID) ? data.user : account));
    } catch (error) {
      window.alert(error.message);
    } finally {
      setApprovingSignupID(null);
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
    { label: "Active Borrows", value: String(summary.active_borrow_records || 0) },
    { label: "Pending Borrow Requests", value: String(summary.pending_borrow_requests || 0) },
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
              className={`admin-info-button ${activeTab === "admin_profile" ? "active" : ""}`}
              onClick={() => setActiveTab("admin_profile")}
              aria-label="Open my admin information"
              title="My admin information"
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

        {activeTab === "member_info" && (
          <div className="content-panel">
            <h3>Member Information</h3>
            <div className="table-wrap">
              <table className="admin-table admin-table-members">
                <thead>
                  <tr><th>Member ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userID}>
                      <td>{member.userID}</td>
                      <td>{member.name}</td>
                      <td>{member.email}</td>
                      <td>{member.phone || "N/A"}</td>
                      <td>{member.address || "N/A"}</td>
                      <td>{formatDate(member.createdAt, "N/A")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!members.length && <p>No members found.</p>}
            </div>
          </div>
        )}

        {activeTab === "admin_profile" && (
          <div className="content-panel">
            <h3>My Admin Information</h3>
            <div className="info-grid">
              {adminInfo.map((item) => (
                <div key={item.label} className="info-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="account-danger-zone account-danger-button-only">
              <button type="button" onClick={() => setDeleteDialogOpen(true)}>
                Delete account
              </button>
            </div>
          </div>
        )}

        {activeTab === "admin_info" && (
          <div className="content-panel">
            <h3>All Admin Information</h3>
            <div className="table-wrap">
              <table className="admin-table admin-table-admins">
                <thead>
                  <tr><th>Admin ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.userID}>
                      <td>{admin.userID}</td>
                      <td>{admin.name}</td>
                      <td>{admin.email}</td>
                      <td>{admin.phone || "N/A"}</td>
                      <td>{admin.address || "N/A"}</td>
                      <td>{formatDate(admin.createdAt, "N/A")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!admins.length && <p>No admins found.</p>}
            </div>
          </div>
        )}

        {activeTab === "signup_approvals" && (
          <div className="content-panel">
            <h3>Signup Approval</h3>
            <div className="table-wrap">
              <table className="admin-table admin-table-signups">
                <thead><tr><th>User ID</th><th>Name</th><th>Email</th><th>Role</th><th>Signup Date</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingSignups.map((account) => (
                    <tr key={account.userID}>
                      <td>{account.userID}</td><td>{account.name}</td><td>{account.email}</td><td>{account.role}</td>
                      <td>{formatDate(account.createdAt, "N/A")}</td>
                      <td><button type="button" className="btn btn-primary small-btn" disabled={approvingSignupID === account.userID} onClick={() => approveSignup(account.userID)}>{approvingSignupID === account.userID ? "Approving..." : "Approve Signup"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!pendingSignups.length && <p>No pending signups.</p>}
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
              <table className="admin-table admin-table-books">
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
                      <td style={{ whiteSpace: "nowrap" }}>TK {Number(book.price || 0).toFixed(0)}</td>
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
              <table className="admin-table admin-table-borrows">
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
                      <td>
                        {(item.status || "").toUpperCase() === "PENDING"
                           ? "Upon approval"
                          : formatDate(item.duedate || item.dueDate, "N/A")}
                      </td>
                      <td>{item.returndate || item.returnDate ? formatDate(item.returndate || item.returnDate) : "Not returned"}</td>
                      <td>
                        <span className={`status-chip status-${(item.status || "").toLowerCase()}`}>
                          {(item.status || "").toUpperCase() === "PENDING" ? (
                            <>PENDING<br />APPROVAL</>
                          ) : (item.status || "N/A")}
                        </span>
                      </td>
                      <td>TK {Number(item.delayfee || item.delayFee || 0).toFixed(0)}</td>
                      <td>
                        {(item.status || "").toUpperCase() === "PENDING" ? (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              className="btn btn-primary small-btn borrow-action-btn"
                              style={{ lineHeight: 1.2, textAlign: "center" }}
                              disabled={approvingBorrowID === (item.borrowid || item.borrowID) || rejectingBorrowID === (item.borrowid || item.borrowID)}
                              onClick={() => approveBorrow(item.borrowid || item.borrowID)}
                            >
                              {approvingBorrowID === (item.borrowid || item.borrowID) ? "Approving..." : <>Approve<br />Borrow</>}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary small-btn btn-danger-outline borrow-action-btn"
                              disabled={approvingBorrowID === (item.borrowid || item.borrowID) || rejectingBorrowID === (item.borrowid || item.borrowID)}
                              onClick={() => rejectBorrow(item.borrowid || item.borrowID)}
                            >
                              {rejectingBorrowID === (item.borrowid || item.borrowID) ? "Rejecting..." : "Reject"}
                            </button>
                          </div>
                        ) : ["BORROWED", "OVERDUE"].includes((item.status || "").toUpperCase()) ? (
                          <button
                            type="button"
                            className="btn btn-primary small-btn borrow-action-btn"
                            disabled={returningBorrowID === (item.borrowid || item.borrowID)}
                            onClick={() => processReturn(item.borrowid || item.borrowID)}
                          >
                            {returningBorrowID === (item.borrowid || item.borrowID) ? "Processing..." : "Process Return"}
                          </button>
                        ) : (
                          <span>
                            {(item.status || "").toUpperCase() === "REJECTED"
                              ? "Rejected"
                              : (item.returndate || item.returnDate ? formatDate(item.returndate || item.returnDate) : "Returned")}
                          </span>
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
              <table className="admin-table admin-table-orders">
                <thead>
                  <tr>
                    <th>Purchase No</th>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Order Date</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Publisher</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedBookInfo.map((item) => (
                    <tr key={item.purchaseno || item.purchaseNo}>
                      <td>{item.purchaseno ?? item.purchaseNo}</td>
                      <td>{item.book_name || item.bookName || "N/A"}</td>
                      <td>{item.member_name || item.memberName || "N/A"}</td>
                      <td>{formatDate(item.orderedAt || item.ordered_at || item.orderdate || item.orderDate, "N/A")}</td>
                      <td>{item.quantity || 1}</td>
                      <td>TK {Number(item.price || 0).toFixed(0)}</td>
                      <td>{item.publisher_name || item.publisherName || "N/A"}</td>
                      <td>
                        {(item.status || "PENDING").toUpperCase() === "PENDING" ? (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              className="btn btn-primary small-btn order-action-btn"
                              style={{ lineHeight: 1.2, textAlign: "center" }}
                              disabled={approvingOrderID === (item.purchaseno || item.purchaseNo) || rejectingOrderID === (item.purchaseno || item.purchaseNo)}
                              onClick={() => approveOrder(item.purchaseno || item.purchaseNo)}
                            >
                              {approvingOrderID === (item.purchaseno || item.purchaseNo) ? "Approving..." : <>Approve<br />Order</>}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary small-btn btn-danger-outline order-action-btn"
                              style={{ lineHeight: 1.2, textAlign: "center" }}
                              disabled={approvingOrderID === (item.purchaseno || item.purchaseNo) || rejectingOrderID === (item.purchaseno || item.purchaseNo)}
                              onClick={() => rejectOrder(item.purchaseno || item.purchaseNo)}
                            >
                              {rejectingOrderID === (item.purchaseno || item.purchaseNo) ? "Rejecting..." : <>Reject<br />Order</>}
                            </button>
                          </div>
                        ) : (
                          <span className={`status-chip status-${(item.status || "").toLowerCase()}`}>
                            {(item.status || "").toUpperCase() === "REJECTED" ? "Rejected" : "Approved"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "book_reviews" && (
          <div className="content-panel">
            <h3>Book Reviews</h3>
            <div className="table-wrap">
              <table className="admin-table admin-table-reviews">
                <thead><tr><th>Book</th><th>Member</th><th>Rating</th><th>Review</th><th>Date</th></tr></thead>
                <tbody>{bookReviews.map((review) => <tr key={review.reviewID}><td>{review.book_name || "N/A"}</td><td>{review.member_name || "N/A"}</td><td>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</td><td>{review.comment || "—"}</td><td>{formatDate(review.createdAt, "—")}</td></tr>)}</tbody>
              </table>
              {!bookReviews.length && <p>No book reviews found.</p>}
            </div>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="content-panel">
            <h3>Feedback</h3>
            <div className="table-wrap">
              <table className="admin-table admin-table-feedback">
                <thead><tr><th>Member</th><th>Rating</th><th>Feedback</th><th>Date</th></tr></thead>
                <tbody>{feedback.map((item) => <tr key={item.libReviewID}><td>{item.member_name || "N/A"}</td><td>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</td><td>{item.reportDetails || "—"}</td><td>{formatDate(item.createdAt, "—")}</td></tr>)}</tbody>
              </table>
              {!feedback.length && <p>No feedback found.</p>}
            </div>
          </div>
        )}
      </div>
      <AccountDeletionDialog
        user={user}
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDeleted={onAccountDeleted}
      />
    </div>
  );
}
