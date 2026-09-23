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
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [feedback, setFeedback] = useState([]);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [pendingSignups, setPendingSignups] = useState([]);
  const [approvingSignupID, setApprovingSignupID] = useState(null);
  const [returningBorrowID, setReturningBorrowID] = useState(null);
  const [resolvingFineID, setResolvingFineID] = useState(null);
  const [approvingOrderID, setApprovingOrderID] = useState(null);
  const [rejectingOrderID, setRejectingOrderID] = useState(null);
  const [orderDiscounts, setOrderDiscounts] = useState({});
  const [approvingBorrowID, setApprovingBorrowID] = useState(null);
  const [rejectingBorrowID, setRejectingBorrowID] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [changeBook, setChangeBook] = useState(null);
  const [changeForm, setChangeForm] = useState({ borrowDelta: 0, orderDelta: 0, price: "" });
  const [savingBook, setSavingBook] = useState(false);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const token = sessionStorage.getItem('library_token');
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
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/admin/borrow-records/${borrowID}/return`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not process return.');
      setBorrowBookInfo((current) => current.map((item) =>
        String(item.borrowid || item.borrowID) === String(borrowID)
          ? { ...item, ...data.record, status: data.record.status, returndate: data.record.returnDate, returnDate: data.record.returnDate, delayfee: data.record.delayFee, delayFee: data.record.delayFee }
          : item
      ));
      setBookInfo((current) => current.map((item) =>
        String(item.bookid || item.bookID) === String(data.record.bookID)
          ? { ...item, availableBorrowCopies: Number(item.availableBorrowCopies ?? item.availableborrowcopies ?? 0) + 1 }
          : item
      ));
      if (Number(data.record.delayFee || 0) === 0) {
        setSummary((current) => ({ ...current, active_borrow_records: Math.max(0, Number(current.active_borrow_records || 0) - 1) }));
      }
    } catch (error) {
      window.alert(error.message);
    } finally {
      setReturningBorrowID(null);
    }
  };

  const resolveFine = async (borrowID, resolution) => {
    setResolvingFineID(borrowID);
    try {
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/admin/borrow-records/${borrowID}/fine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ resolution }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not resolve fine.');
      setBorrowBookInfo((current) => current.map((item) => (
        String(item.borrowid || item.borrowID) === String(borrowID)
          ? { ...item, ...data.record, returndate: data.record.returnDate, returnDate: data.record.returnDate, fineActionAt: data.record.fineActionAt }
          : item
      )));
    } catch (error) {
      window.alert(error.message);
    } finally {
      setResolvingFineID(null);
    }
  };

  const approveBorrow = async (borrowID) => {
    setApprovingBorrowID(borrowID);
    try {
      const token = sessionStorage.getItem('library_token');
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
      const token = sessionStorage.getItem('library_token');
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
            ? { ...item, availableBorrowCopies: Number(item.availableBorrowCopies ?? item.availableborrowcopies ?? 0) + 1 }
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
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/admin/orders/${purchaseNo}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ discountPercentage: Number(orderDiscounts[purchaseNo] || 0) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not approve order.');
      setOrderedBookInfo((current) => current.map((item) =>
        String(item.purchaseno || item.purchaseNo) === String(purchaseNo)
          ? { ...item, ...data.order, status: data.order.status, approvedAt: data.order.approvedAt }
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
      const token = sessionStorage.getItem('library_token');
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
            ? { ...item, availableOrderCopies: Number(item.availableOrderCopies ?? item.availableordercopies ?? 0) + Number(data.order.quantity || 1) }
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
      const token = sessionStorage.getItem('library_token');
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

  const openBookChange = (book) => {
    setChangeBook(book);
    setChangeForm({ borrowDelta: 0, orderDelta: 0, price: Number(book.price || 0).toFixed(2) });
    setActiveTab("change_book");
  };

  const saveBookChange = async (event) => {
    event.preventDefault();
    if (!changeBook || savingBook) return;
    setSavingBook(true);
    try {
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/admin/books/${changeBook.bookID || changeBook.bookid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          borrowDelta: Number(changeForm.borrowDelta),
          orderDelta: Number(changeForm.orderDelta),
          price: Number(changeForm.price),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update this book.');
      setBookInfo((current) => current.map((book) => (
        String(book.bookID || book.bookid) === String(changeBook.bookID || changeBook.bookid)
          ? { ...book, ...data.book }
          : book
      )));
      setChangeBook({ ...changeBook, ...data.book });
      setChangeForm((current) => ({ ...current, borrowDelta: 0, orderDelta: 0, price: Number(data.book.price || 0).toFixed(2) }));
      window.alert('Book details updated successfully.');
    } catch (error) {
      window.alert(error.message);
    } finally {
      setSavingBook(false);
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
  const filteredBookReviews = reviewFilter === "ALL"
    ? bookReviews
    : bookReviews.filter((review) => review.reviewSource === reviewFilter);

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
                    <th>Available Copies for Borrow</th>
                    <th>Available Copies for Order</th>
                    <th>Borrowed Times</th>
                    <th>Sold</th>
                    <th>Price</th>
                    <th>Change</th>
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
                      <td>{book.availableBorrowCopies ?? book.availableborrowcopies ?? 0} / {book.totalCopies ?? 0}</td>
                      <td>{book.availableOrderCopies ?? book.availableordercopies ?? 0}</td>
                      <td>{book.borrow_count ?? book.borrowCount ?? 0}</td>
                      <td>{book.sold_count ?? book.soldCount ?? 0}</td>
                      <td style={{ whiteSpace: "nowrap" }}>TK {Number(book.price || 0).toFixed(0)}</td>
                      <td>
                        <button type="button" className="btn btn-primary small-btn" onClick={() => openBookChange(book)}>
                          Change
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "change_book" && changeBook && (
          <div className="content-panel book-change-panel">
            <div className="section-heading-row">
              <div>
                <h3>Change Book</h3>
                <p className="book-change-subtitle">{changeBook.title} (Book ID: {changeBook.bookID || changeBook.bookid})</p>
              </div>
              <button type="button" className="btn btn-secondary small-btn" onClick={() => setActiveTab("book_info")}>Back to Book Info</button>
            </div>
            <div className="book-change-current">
              <div><span>Borrow copies available</span><strong>{changeBook.availableBorrowCopies ?? 0} / {changeBook.totalCopies ?? 0}</strong></div>
              <div><span>Order copies available</span><strong>{changeBook.availableOrderCopies ?? 0}</strong></div>
              <div><span>Previous price</span><strong>TK {Number(changeBook.price || 0).toFixed(2)}</strong></div>
            </div>
            <form className="book-change-form" onSubmit={saveBookChange}>
              <label>
                Borrow copies change
                <input type="number" step="1" value={changeForm.borrowDelta} onChange={(event) => setChangeForm((current) => ({ ...current, borrowDelta: event.target.value }))} />
                <small>Use a positive number to add copies or a negative number to remove copies.</small>
              </label>
              <label>
                Order copies change
                <input type="number" step="1" value={changeForm.orderDelta} onChange={(event) => setChangeForm((current) => ({ ...current, orderDelta: event.target.value }))} />
                <small>Use a positive number to add copies or a negative number to remove copies.</small>
              </label>
              <label>
                New book price (TK)
                <input type="number" min="0" step="0.01" value={changeForm.price} onChange={(event) => setChangeForm((current) => ({ ...current, price: event.target.value }))} required />
              </label>
              <button type="submit" className="btn btn-primary" disabled={savingBook}>{savingBook ? "Saving..." : "Save Changes"}</button>
            </form>
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
                    <th>Copy</th>
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
                      <td>{item.copyNumber ?? item.copynumber ?? "N/A"}</td>
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
                          ) : (item.status || "").toUpperCase() === "FINE_DUE" ? (
                            "Fine due"
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
                        ) : (item.status || "").toUpperCase() === "FINE_DUE" ? (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              className="btn btn-primary small-btn borrow-action-btn"
                              disabled={resolvingFineID === (item.borrowid || item.borrowID)}
                              onClick={() => resolveFine(item.borrowid || item.borrowID, "RETURNED_WITH_FINE")}
                            >
                              {resolvingFineID === (item.borrowid || item.borrowID) ? "Saving..." : <>Returned<br />with fine</>}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary small-btn btn-danger-outline borrow-action-btn"
                              disabled={resolvingFineID === (item.borrowid || item.borrowID)}
                              onClick={() => resolveFine(item.borrowid || item.borrowID, "FINE_WAIVED")}
                            >
                              Fine waved
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
                              : ["RETURNED_WITH_FINE", "FINE_WAIVED"].includes((item.status || "").toUpperCase())
                                ? formatDate(item.fineActionAt || item.fineactionat, "N/A")
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
                    <th>Actual Price</th>
                    <th>Discount</th>
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
                      <td>TK {Number(item.actualprice ?? item.actualPrice ?? item.price ?? 0).toFixed(0)}</td>
                      <td>
                        {(item.status || "PENDING").toUpperCase() === "PENDING" ? (
                          <div className="discount-input-wrap">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              step="0.01"
                              value={orderDiscounts[item.purchaseno || item.purchaseNo] ?? item.discountpercentage ?? item.discountPercentage ?? 0}
                              onChange={(event) => setOrderDiscounts((current) => ({ ...current, [item.purchaseno || item.purchaseNo]: event.target.value }))}
                              aria-label={`Discount for order ${item.purchaseno || item.purchaseNo}`}
                            />%
                          </div>
                        ) : `${Number(item.discountpercentage ?? item.discountPercentage ?? 0).toFixed(2)}%`}
                      </td>
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
            <div className="section-heading-row">
              <h3>Book Reviews</h3>
              <label className="review-filter-control">
                Review source
                <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
                  <option value="ALL">All</option>
                  <option value="BORROWED">Borrowed</option>
                  <option value="BOUGHT">Bought</option>
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table className="admin-table admin-table-reviews">
                <thead><tr><th>Book</th><th>Member</th><th>Source</th><th>Rating</th><th>Review</th><th>Date</th></tr></thead>
                <tbody>{filteredBookReviews.map((review) => <tr key={review.reviewID}><td>{review.book_name || "N/A"}</td><td>{review.member_name || "N/A"}</td><td>{review.reviewSource === "BOUGHT" ? "Bought" : "Borrowed"}</td><td>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</td><td>{review.comment || "—"}</td><td>{formatDate(review.createdAt, "—")}</td></tr>)}</tbody>
              </table>
              {!filteredBookReviews.length && <p>No book reviews found for this source.</p>}
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
