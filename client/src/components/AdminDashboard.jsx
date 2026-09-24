import { useEffect, useState } from "react";
import "./Login.css";
import AccountDeletionDialog from "./AccountDeletionDialog";

const adminTabs = [
  { key: "member_info", label: "Member Info" },
  { key: "admin_info", label: "Admin Info" },
  { key: "admin_signup_approvals", label: "Admin Signup Approval" },
  { key: "library_info", label: "Library Info" },
  { key: "book_info", label: "Book Info" },
  { key: "borrow_book_info", label: "Borrow Book Info" },
  { key: "ordered_book_info", label: "Ordered Book Info" },
  { key: "book_reviews", label: "Book Reviews" },
  { key: "feedback", label: "Feedback" },
];

const sidebarTabs = [
  { key: "admin_profile", label: "My Admin Info" },
  ...adminTabs,
];

const BOOKS_PER_PAGE = 20;
const BORROWS_PER_PAGE = 20;
const ORDERS_PER_PAGE = 20;
const DEFAULT_SUMMARY = {
  total_users: 0,
  total_books: 0,
  active_borrow_records: 0,
  pending_borrow_requests: 0,
  total_orders: 0,
  total_library_reviews: 0,
};

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
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [bookInfo, setBookInfo] = useState([]);
  const [borrowBookInfo, setBorrowBookInfo] = useState([]);
  const [orderedBookInfo, setOrderedBookInfo] = useState([]);
  const [bookPage, setBookPage] = useState(0);
  const [borrowPage, setBorrowPage] = useState(0);
  const [orderPage, setOrderPage] = useState(0);
  const [bookSearch, setBookSearch] = useState("");
  const [borrowBookSearch, setBorrowBookSearch] = useState("");
  const [orderBookSearch, setOrderBookSearch] = useState("");
  const [bookReviews, setBookReviews] = useState([]);
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [feedback, setFeedback] = useState([]);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [pendingAdminSignups, setPendingAdminSignups] = useState([]);
  const [approvingAdminSignupID, setApprovingAdminSignupID] = useState(null);
  const [returningBorrowID, setReturningBorrowID] = useState(null);
  const [resolvingFineID, setResolvingFineID] = useState(null);
  const [approvingOrderID, setApprovingOrderID] = useState(null);
  const [rejectingOrderID, setRejectingOrderID] = useState(null);
  const [openOrderActionID, setOpenOrderActionID] = useState(null);
  const [orderApprovalModal, setOrderApprovalModal] = useState(null);
  const [approvingBorrowID, setApprovingBorrowID] = useState(null);
  const [rejectingBorrowID, setRejectingBorrowID] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [changeBook, setChangeBook] = useState(null);
  const [changeForm, setChangeForm] = useState({ borrowDelta: 0, orderDelta: 0, price: "" });
  const [savingBook, setSavingBook] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [bioText, setBioText] = useState(user?.bio || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [accountForm, setAccountForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const updateBookInfo = (value) => {
    setBookInfo(value);
    setBookPage(0);
  };
  const updateBorrowBookInfo = (value) => {
    setBorrowBookInfo(value);
    setBorrowPage(0);
  };
  const updateOrderedBookInfo = (value) => {
    setOrderedBookInfo(value);
    setOrderPage(0);
    setOpenOrderActionID(null);
  };

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

        const summaryData = summaryRes.ok ? await summaryRes.json() : DEFAULT_SUMMARY;
        const booksData = booksRes.ok ? await booksRes.json() : [];
        const borrowData = borrowRes.ok ? await borrowRes.json() : [];
        const orderData = ordersRes.ok ? await ordersRes.json() : [];
        const reviewData = reviewsRes.ok ? await reviewsRes.json() : [];
        const feedbackData = feedbackRes.ok ? await feedbackRes.json() : [];
        const usersData = usersRes.ok ? await usersRes.json() : [];

        setSummary(summaryData);
        updateBookInfo(booksData);
        updateBorrowBookInfo(borrowData);
        updateOrderedBookInfo(orderData);
        setBookReviews(reviewData);
        setFeedback(feedbackData);
        setMembers(usersData.filter((account) => account.role === "MEMBER"));
        setAdmins(usersData.filter((account) => account.role === "ADMIN" && account.isApproved !== false));
        setPendingAdminSignups(usersData.filter((account) => account.role === "ADMIN" && account.isApproved === false));
      } catch {
        setSummary(DEFAULT_SUMMARY);
        updateBookInfo([]);
        updateBorrowBookInfo([]);
        updateOrderedBookInfo([]);
        setMembers([]);
        setAdmins([]);
        setPendingAdminSignups([]);
      }
    };

    fetchAdminData();
  }, []);

  useEffect(() => {
    if (openOrderActionID === null) return undefined;

    const handleOutsideClick = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.order-action-menu')) {
        setOpenOrderActionID(null);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenOrderActionID(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openOrderActionID]);

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
      updateBorrowBookInfo((current) => current.map((item) =>
        String(item.borrowid || item.borrowID) === String(borrowID)
          ? { ...item, ...data.record, status: data.record.status, returndate: data.record.returnDate, returnDate: data.record.returnDate, delayfee: data.record.delayFee, delayFee: data.record.delayFee }
          : item
      ));
      updateBookInfo((current) => current.map((item) =>
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
      updateBorrowBookInfo((current) => current.map((item) => (
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
      updateBorrowBookInfo((current) => current.map((item) =>
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
      updateBorrowBookInfo((current) => current.map((item) =>
        String(item.borrowid || item.borrowID) === String(borrowID)
          ? { ...item, status: data.record.status }
          : item
      ));
      if (data.record?.bookID) {
        updateBookInfo((current) => current.map((item) =>
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

  const approveOrder = async (purchaseNo, discountPercentage = 0) => {
    setApprovingOrderID(purchaseNo);
    try {
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/admin/orders/${purchaseNo}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ discountPercentage: Number(discountPercentage || 0) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not approve order.');
      updateOrderedBookInfo((current) => current.map((item) =>
        String(item.purchaseno || item.purchaseNo) === String(purchaseNo)
          ? { ...item, ...data.order, status: data.order.status, approvedAt: data.order.approvedAt }
          : item
      ));
      return true;
    } catch (error) {
      window.alert(error.message);
      return false;
    } finally {
      setApprovingOrderID(null);
    }
  };

  const openOrderApproval = (item) => {
    const purchaseNo = item.purchaseno ?? item.purchaseNo;
    setOrderApprovalModal({
      purchaseNo,
      bookName: item.book_name || item.bookName || "N/A",
      memberName: item.member_name || item.memberName || "N/A",
      price: Number(item.actualprice ?? item.actualPrice ?? item.price ?? 0),
      discount: Number(item.discountpercentage ?? item.discountPercentage ?? 0),
    });
  };

  const confirmOrderApproval = async () => {
    if (!orderApprovalModal) return;
    const discount = Number(orderApprovalModal.discount);
    if (!Number.isFinite(discount) || discount < 0 || discount > 50) {
      window.alert('Discount must be between 0 and 50%.');
      return;
    }
    const approved = await approveOrder(orderApprovalModal.purchaseNo, discount);
    if (approved) setOrderApprovalModal(null);
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
      updateOrderedBookInfo((current) => current.map((item) =>
        String(item.purchaseno || item.purchaseNo) === String(purchaseNo)
          ? { ...item, status: data.order.status }
          : item
      ));
      if (data.order?.bookID) {
        updateBookInfo((current) => current.map((item) =>
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

  const openBookChange = (book) => {
    setChangeBook(book);
    setChangeForm({ borrowDelta: 0, orderDelta: 0, price: Number(book.price || 0).toFixed(2) });
    setActiveTab("change_book");
  };

  const approveAdminSignup = async (userID) => {
    setApprovingAdminSignupID(userID);
    try {
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/admin/admin-signup-approvals/${userID}/approve`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not approve admin signup.');

      setPendingAdminSignups((current) => current.filter((account) => String(account.userID) !== String(userID)));
      setAdmins((current) => [data.user, ...current.filter((account) => String(account.userID) !== String(userID))]);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setApprovingAdminSignupID(null);
    }
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
      updateBookInfo((current) => current.map((book) => (
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

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/users/${user.userID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          avatar: avatarPreview,
          bio: bioText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update profile.');

      const storedUser = JSON.parse(sessionStorage.getItem('library_user') || '{}');
      const updatedUser = { ...storedUser, ...data, name: profileName, email: profileEmail };
      sessionStorage.setItem('library_user', JSON.stringify(updatedUser));
      setAvatarPreview(data.avatar || null);
      setBioText(data.bio || "");
      window.alert('Profile updated successfully.');
    } catch (error) {
      window.alert(error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Please select an image file.');
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert('Image must be smaller than 2 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const openAccountEditor = () => {
    setAccountForm({ name: profileName, email: profileEmail });
    setEditAccountOpen(true);
  };

  const saveAccount = async () => {
    const name = accountForm.name.trim();
    const email = accountForm.email.trim().toLowerCase();
    if (!name || !email) {
      window.alert('Name and email are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      window.alert('Please enter a valid email address.');
      return;
    }

    setSavingAccount(true);
    try {
      const token = sessionStorage.getItem('library_token');
      const response = await fetch(`/api/users/${user.userID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({ name, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update account.');

      const storedUser = JSON.parse(sessionStorage.getItem('library_user') || '{}');
      const updatedUser = { ...storedUser, ...data };
      sessionStorage.setItem('library_user', JSON.stringify(updatedUser));
      setProfileName(data.name || name);
      setProfileEmail(data.email || email);
      setAccountForm({ name: data.name || name, email: data.email || email });
      setAdmins((current) => current.map((account) => (
        String(account.userID) === String(user.userID) ? { ...account, ...data } : account
      )));
      setEditAccountOpen(false);
      window.alert('Account updated successfully.');
    } catch (error) {
      window.alert(error.message);
    } finally {
      setSavingAccount(false);
    }
  };

  const adminInfo = [
    { label: "Admin ID", value: user?.userID ?? "N/A" },
    { label: "Name", value: profileName || "N/A" },
    { label: "Email", value: profileEmail || "N/A" },
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
  const matchesBookSearch = (values, query) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return !normalizedQuery || values.some((value) => String(value || "").toLocaleLowerCase().includes(normalizedQuery));
  };
  const filteredBooks = bookInfo.filter((book) => matchesBookSearch([
    book.title,
    book.genre,
    book.author_names,
    book.authorName,
    book.publishername,
    book.publisherName,
    book.bookid,
    book.bookID,
  ], bookSearch));
  const filteredBorrows = borrowBookInfo.filter((item) => matchesBookSearch([
    item.book_name,
    item.bookName,
    item.bookid,
    item.bookID,
  ], borrowBookSearch));
  const filteredOrders = orderedBookInfo.filter((item) => matchesBookSearch([
    item.book_name,
    item.bookName,
    item.bookid,
    item.bookID,
  ], orderBookSearch));
  const totalBookPages = Math.ceil(filteredBooks.length / BOOKS_PER_PAGE);
  const totalBorrowPages = Math.ceil(filteredBorrows.length / BORROWS_PER_PAGE);
  const totalOrderPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedBooks = filteredBooks.slice(bookPage * BOOKS_PER_PAGE, (bookPage + 1) * BOOKS_PER_PAGE);
  const paginatedBorrows = filteredBorrows.slice(borrowPage * BORROWS_PER_PAGE, (borrowPage + 1) * BORROWS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(orderPage * ORDERS_PER_PAGE, (orderPage + 1) * ORDERS_PER_PAGE);
  const sidebarActiveTab = activeTab === "change_book" ? "book_info" : activeTab;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            {avatarPreview ? (
              <img src={avatarPreview} alt={`${profileName || "Admin"} avatar`} />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.25" />
                <path d="M5.5 20c.7-3.2 2.8-5 6.5-5s5.8 1.8 6.5 5" />
              </svg>
            )}
          </div>
          <p className="sidebar-name">{profileName}</p>
          <span className="sidebar-role">{user.role || "ADMIN"}</span>
        </div>
        <nav className="sidebar-nav" aria-label="Admin dashboard navigation">
          {sidebarTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={sidebarActiveTab === tab.key ? "sidebar-nav-item active" : "sidebar-nav-item"}
              onClick={() => setActiveTab(tab.key)}
              aria-current={sidebarActiveTab === tab.key ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" onClick={onLogout} className="btn btn-secondary small-btn">
            Sign Out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <h2>Welcome, {profileName}!</h2>
          <p className="auth-subtitle">{profileEmail}</p>
        </header>
        <div className="admin-content">

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
            <div className="admin-profile-layout">
              <div className="profile-avatar-section">
                <div className="profile-avatar-large">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Admin avatar" />
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="8" r="3.25" />
                      <path d="M5.5 20c.7-3.2 2.8-5 6.5-5s5.8 1.8 6.5 5" />
                    </svg>
                  )}
                </div>
                <label className="btn btn-secondary small-btn avatar-upload-btn">
                  Upload Photo
                  <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                </label>
              </div>

              <div className="info-grid">
                {adminInfo.map((item) => (
                  <div key={item.label} className="info-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="profile-bio-section">
                <label>
                  Bio
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Write a short bio..."
                    value={bioText}
                    onChange={(event) => setBioText(event.target.value)}
                  />
                </label>
                <button type="button" className="btn btn-primary small-btn" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
            <div className="account-actions-row">
              <button type="button" className="btn btn-secondary small-btn account-edit-trigger" onClick={openAccountEditor}>
                Edit Account
              </button>
              <div className="account-danger-zone account-danger-button-only">
                <button type="button" onClick={() => setDeleteDialogOpen(true)}>
                  Delete account
                </button>
              </div>
            </div>
            {editAccountOpen && (
              <div className="account-edit-panel">
                <div className="account-edit-heading">
                  <h4>Edit Account</h4>
                  <p>Update the name and email used for your admin account.</p>
                </div>
                <div className="form-row account-edit-fields">
                  <label className="form-group">
                    Name
                    <input
                      className="form-control"
                      type="text"
                      value={accountForm.name}
                      onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))}
                      autoComplete="name"
                    />
                  </label>
                  <label className="form-group">
                    Email
                    <input
                      className="form-control"
                      type="email"
                      value={accountForm.email}
                      onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))}
                      autoComplete="email"
                    />
                  </label>
                </div>
                <div className="account-edit-actions">
                  <button type="button" className="btn btn-secondary small-btn" onClick={() => setEditAccountOpen(false)} disabled={savingAccount}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary small-btn" onClick={saveAccount} disabled={savingAccount}>
                    {savingAccount ? "Saving..." : "Save Account"}
                  </button>
                </div>
              </div>
            )}
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

        {activeTab === "admin_signup_approvals" && (
          <div className="content-panel">
            <h3>Admin Signup Approval</h3>
            <p className="admin-signup-note">Only an existing admin can approve these requests.</p>
            <div className="table-wrap">
              <table className="admin-table admin-table-admin-signups">
                <thead>
                  <tr><th>Request ID</th><th>Name</th><th>Email</th><th>Signup Date</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {pendingAdminSignups.map((account) => (
                    <tr key={account.userID}>
                      <td>{account.userID}</td>
                      <td>{account.name}</td>
                      <td>{account.email}</td>
                      <td>{formatDate(account.createdAt, "N/A")}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary small-btn"
                          disabled={approvingAdminSignupID === account.userID}
                          onClick={() => approveAdminSignup(account.userID)}
                        >
                          {approvingAdminSignupID === account.userID ? "Approving..." : "Approve Admin"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!pendingAdminSignups.length && <p>No pending admin signup requests.</p>}
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
            <div className="section-heading-row book-table-heading-row">
              <h3>Book Info</h3>
              <input
                className="table-search-input"
                type="search"
                aria-label="Search books by title, author, genre, publisher, or ID"
                placeholder="Search books..."
                value={bookSearch}
                onChange={(event) => {
                  setBookSearch(event.target.value);
                  setBookPage(0);
                }}
              />
              {totalBookPages > 1 && (
                <div className="pagination-controls" aria-label="Book table pagination">
                  <button type="button" disabled={bookPage === 0} onClick={() => setBookPage((page) => page - 1)}>
                    ← Previous Page
                  </button>
                  <span>Page {bookPage + 1} of {totalBookPages}</span>
                  <button type="button" disabled={bookPage >= totalBookPages - 1} onClick={() => setBookPage((page) => page + 1)}>
                    Next Page →
                  </button>
                </div>
              )}
            </div>
            <div className="table-wrap">
              <table className="admin-table admin-table-books">
                <thead>
                  <tr>
                    <th>Book ID</th>
                    <th>Title</th>
                    <th>Genre</th>
                    <th>Author</th>
                    <th>Publisher</th>
                    <th>Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBooks.map((book) => (
                    <tr key={book.bookid || book.bookID}>
                      <td>{book.bookid ?? book.bookID}</td>
                      <td>{book.title}</td>
                      <td>{book.genre || "N/A"}</td>
                      <td>{book.author_names || book.authorName || "N/A"}</td>
                      <td>{book.publishername || book.publisherName || "N/A"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>TK {Number(book.price || 0).toFixed(0)}</td>
                      <td>
                        <button type="button" className="btn btn-primary small-btn" onClick={() => openBookChange(book)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!paginatedBooks.length && <p className="table-empty-message">No books match your search.</p>}
            </div>
          </div>
        )}

        {activeTab === "change_book" && changeBook && (
          <div className="content-panel book-change-panel">
            <div className="section-heading-row">
              <div>
                <h3>Edit Book</h3>
                <p className="book-change-subtitle">{changeBook.title} (Book ID: {changeBook.bookID || changeBook.bookid})</p>
              </div>
              <button type="button" className="btn btn-secondary small-btn" onClick={() => setActiveTab("book_info")}>Back to Book Info</button>
            </div>
            <div className="book-change-current">
              <div><span>Borrow copies available</span><strong>{changeBook.availableBorrowCopies ?? changeBook.availableborrowcopies ?? 0} / {changeBook.totalCopies ?? changeBook.totalcopies ?? 0}</strong></div>
              <div><span>Order copies available</span><strong>{changeBook.availableOrderCopies ?? changeBook.availableordercopies ?? 0}</strong></div>
              <div><span>Borrowed times</span><strong>{changeBook.borrow_count ?? changeBook.borrowCount ?? 0}</strong></div>
              <div><span>Sold</span><strong>{changeBook.sold_count ?? changeBook.soldCount ?? 0}</strong></div>
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
            <div className="section-heading-row book-table-heading-row">
              <h3>Borrow Book Info</h3>
              <input
                className="table-search-input"
                type="search"
                aria-label="Search borrowed books by title or book ID"
                placeholder="Search books..."
                value={borrowBookSearch}
                onChange={(event) => {
                  setBorrowBookSearch(event.target.value);
                  setBorrowPage(0);
                }}
              />
              {totalBorrowPages > 1 && (
                <div className="pagination-controls" aria-label="Borrow table pagination">
                  <button type="button" disabled={borrowPage === 0} onClick={() => setBorrowPage((page) => page - 1)}>
                    ← Previous Page
                  </button>
                  <span>Page {borrowPage + 1} of {totalBorrowPages}</span>
                  <button type="button" disabled={borrowPage >= totalBorrowPages - 1} onClick={() => setBorrowPage((page) => page + 1)}>
                    Next Page →
                  </button>
                </div>
              )}
            </div>
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
                  {paginatedBorrows.map((item) => (
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
                              {approvingBorrowID === (item.borrowid || item.borrowID) ? "Approving..." : "Approve"}
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
                            className="btn btn-primary small-btn borrow-action-btn return-action-btn"
                            disabled={returningBorrowID === (item.borrowid || item.borrowID)}
                            onClick={() => processReturn(item.borrowid || item.borrowID)}
                          >
                            {returningBorrowID === (item.borrowid || item.borrowID) ? "Processing..." : <>Process<br />Return</>}
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
              {!paginatedBorrows.length && <p className="table-empty-message">No borrow records match your search.</p>}
            </div>
          </div>
        )}

        {activeTab === "ordered_book_info" && (
          <div className="content-panel">
            <div className="section-heading-row book-table-heading-row">
              <h3>Ordered Book Info</h3>
              <input
                className="table-search-input"
                type="search"
                aria-label="Search ordered books by title or book ID"
                placeholder="Search books..."
                value={orderBookSearch}
                onChange={(event) => {
                  setOrderBookSearch(event.target.value);
                  setOrderPage(0);
                }}
              />
              <div className="pagination-controls" aria-label="Order table pagination">
                <button type="button" disabled={orderPage === 0 || totalOrderPages === 0} onClick={() => setOrderPage((page) => page - 1)}>
                  ← Previous Page
                </button>
                <span>{totalOrderPages ? `Page ${orderPage + 1} of ${totalOrderPages}` : "No matches"}</span>
                <button type="button" disabled={orderPage >= totalOrderPages - 1} onClick={() => setOrderPage((page) => page + 1)}>
                  Next Page →
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="admin-table admin-table-orders">
                <thead>
                  <tr>
                    <th>Purchase No</th>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Order Date</th>
                    <th>Quantity</th>
                    <th>Sold Price</th>
                    <th>Publisher</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((item) => (
                    <tr key={item.purchaseno || item.purchaseNo}>
                      <td>{item.purchaseno ?? item.purchaseNo}</td>
                      <td>{item.book_name || item.bookName || "N/A"}</td>
                      <td>{item.member_name || item.memberName || "N/A"}</td>
                      <td>{formatDate(item.orderedAt || item.ordered_at || item.orderdate || item.orderDate, "N/A")}</td>
                      <td>{item.quantity || 1}</td>
                      <td>{(item.status || "PENDING").toUpperCase() === "APPROVED" ? `TK ${Number(item.price || 0).toFixed(0)}` : "N/A"}</td>
                      <td>{item.publisher_name || item.publisherName || "N/A"}</td>
                      <td>
                        {(item.status || "PENDING").toUpperCase() === "PENDING" ? (
                          <div className="order-action-menu">
                            <button
                              type="button"
                              className="btn btn-secondary small-btn order-actions-trigger"
                              disabled={approvingOrderID === (item.purchaseno || item.purchaseNo) || rejectingOrderID === (item.purchaseno || item.purchaseNo)}
                              onClick={() => setOpenOrderActionID((current) => current === (item.purchaseno || item.purchaseNo) ? null : (item.purchaseno || item.purchaseNo))}
                              aria-haspopup="menu"
                              aria-expanded={openOrderActionID === (item.purchaseno || item.purchaseNo)}
                            >
                              Actions <span className="order-actions-chevron" aria-hidden="true" />
                            </button>
                            {openOrderActionID === (item.purchaseno || item.purchaseNo) && (
                              <div className="order-action-menu-list" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={approvingOrderID === (item.purchaseno || item.purchaseNo) || rejectingOrderID === (item.purchaseno || item.purchaseNo)}
                                  onClick={() => {
                                    setOpenOrderActionID(null);
                                    openOrderApproval(item);
                                  }}
                                >
                                  Approve Order
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="order-action-menu-danger"
                                  disabled={approvingOrderID === (item.purchaseno || item.purchaseNo) || rejectingOrderID === (item.purchaseno || item.purchaseNo)}
                                  onClick={() => {
                                    setOpenOrderActionID(null);
                                    rejectOrder(item.purchaseno || item.purchaseNo);
                                  }}
                                >
                                  Reject Order
                                </button>
                              </div>
                            )}
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
              {!paginatedOrders.length && <p className="table-empty-message">No order records match your search.</p>}
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
      </main>
      {orderApprovalModal && (
        <div className="order-approve-overlay">
          <div className="order-approve-modal" role="dialog" aria-modal="true" aria-labelledby="order-approve-title">
            <h4 id="order-approve-title">Approve Order</h4>
            <div className="modal-detail"><span>Book</span><strong>{orderApprovalModal.bookName}</strong></div>
            <div className="modal-detail"><span>Member</span><strong>{orderApprovalModal.memberName}</strong></div>
            <div className="modal-detail"><span>Original price</span><strong>TK {Number(orderApprovalModal.price || 0).toFixed(2)}</strong></div>
            <label className="order-approval-field">
              Discount (%)
              <input
                className="form-control"
                type="number"
                min="0"
                max="50"
                step="0.01"
                value={orderApprovalModal.discount}
                onChange={(event) => setOrderApprovalModal((current) => ({ ...current, discount: event.target.value }))}
                autoFocus
              />
            </label>
            <div className="modal-detail modal-price-after">
              <span>Price after discount</span>
              <strong>
                TK {(Number(orderApprovalModal.price || 0) * (1 - Math.min(50, Math.max(0, Number(orderApprovalModal.discount) || 0)) / 100)).toFixed(2)}
              </strong>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary small-btn" onClick={() => setOrderApprovalModal(null)} disabled={approvingOrderID !== null}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary small-btn" onClick={confirmOrderApproval} disabled={approvingOrderID === orderApprovalModal.purchaseNo}>
                {approvingOrderID === orderApprovalModal.purchaseNo ? "Approving..." : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
      <AccountDeletionDialog
        user={user}
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDeleted={onAccountDeleted}
      />
    </div>
  );
}
